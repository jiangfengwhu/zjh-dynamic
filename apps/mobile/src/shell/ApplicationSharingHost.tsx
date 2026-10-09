import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Share, View } from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, BottomSheetTextInput, useBottomSheetScrollableCreator } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setApplicationSharingHandler } from "../../../../packages/app-sdk/src/sharing";
import type { ApplicationShareInput } from "../../../../packages/app-sdk/src";
import { useTheme } from "../../../../packages/ui/theme";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { Pressy } from "../../../../packages/ui/chrome";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { HostText as Text } from "./feed/HostText";
import { runningApplication } from "../runtime/applications";
import { fetchMarketDetail } from "./market";
import { createShareText } from "./clipboardShares";
import { composeApplicationShare } from "./navigation";
import { cachedAccountId, requireAccount, useAccount } from "./account";
import { readInbox, readRelations, sendMessage } from "./social/api";
import { UserAvatar } from "./UserAvatar";
import type { PublicAuthor } from "./feed/userPosts";
import { AnimatedFlashList } from "./AnimatedFlashList";
import { PageSkeleton } from "./LoadingSkeleton";

type Request = { appId: string; input: ApplicationShareInput; id: number };
export function ApplicationSharingHost() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { user } = useAccount();
  const sheet = useRef<BottomSheetModal>(null);
  const [request, setRequest] = useState<Request>();
  const current = useRef<Request>();
  const sequence = useRef(0);
  const [friends, setFriends] = useState(false);
  const [kind, setKind] = useState<"recent" | "following">("recent");
  const [people, setPeople] = useState<PublicAuthor[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState<string>();
  const [sent, setSent] = useState<Set<string>>(new Set());
  const sendIds = useRef(new Map<string, string>());
  const sendingRef = useRef(false);
  const selections = useRef(new Map<string, { appId: string; releaseId: string; params?: ApplicationShareInput["params"] }>());
  const listRevision = useRef(0);
  const Scrollable = useBottomSheetScrollableCreator();
  useEffect(() => {
    setApplicationSharingHandler(async (appId, input) => {
      const next = { appId, input, id: ++sequence.current };
      current.current = next; ++listRevision.current;
      setRequest(next); setFriends(false); setPeople([]); setCursor(undefined); setQuery(""); setError(""); setSent(new Set()); setLoading(false); sendIds.current.clear(); selections.current.clear();
    });
    return () => { current.current = undefined; ++listRevision.current; setApplicationSharingHandler(async () => { throw new Error("分享入口尚未就绪"); }); };
  }, []);
  useLayoutEffect(() => { if (request) sheet.current?.present(); }, [request]);
  useEffect(() => { sheet.current?.dismiss(); current.current = undefined; ++listRevision.current; }, [user?.id]);
  useEffect(() => {
    if (!request) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { sheet.current?.dismiss(); return true; });
    return () => subscription.remove();
  }, [request]);
  async function loadPeople(nextKind: typeof kind, more = false) {
    const owner = cachedAccountId();
    if (!owner) { await requireAccount(); return; }
    const version = ++listRevision.current;
    setKind(nextKind); setLoading(true); setError("");
    if (!more) { setPeople([]); setCursor(undefined); }
    try {
      const page = nextKind === "recent" ? await readInbox(more ? cursor : undefined) : await readRelations(owner, "following", more ? cursor : undefined);
      if (version !== listRevision.current || owner !== cachedAccountId()) return;
      const items = "conversations" in page ? page.conversations.map(item => item.peer) : page.authors.map(item => item.author);
      setPeople(previous => [...new Map([...(more ? previous : []), ...items].map(item => [item.id, item])).values()]); setCursor(page.nextCursor ?? undefined);
    } catch (cause) { if (version === listRevision.current) setError(cause instanceof Error ? cause.message : "好友加载失败"); }
    finally { if (version === listRevision.current) setLoading(false); }
  }
  async function chooseFriends() {
    setFriends(true); sheet.current?.snapToIndex(1);
    await loadPeople("recent");
  }
  async function send(peer: PublicAuthor) {
    const active = current.current, owner = cachedAccountId();
    if (!active || !owner || sendingRef.current || sent.has(peer.id)) return;
    sendingRef.current = true; setSending(peer.id);
    let id = sendIds.current.get(peer.id);
    if (!id) { id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; sendIds.current.set(peer.id, id); }
    try {
      let selection = selections.current.get(peer.id);
      if (!selection) {
        const application = await fetchMarketDetail(active.appId, { immediate: true });
        selection = { appId: active.appId, releaseId: application.manifest.releaseId, params: active.input.params };
        if (owner !== cachedAccountId() || active !== current.current) return;
        selections.current.set(peer.id, selection);
      }
      if (owner !== cachedAccountId() || active !== current.current) return;
      await sendMessage(peer.id, [active.input.title, active.input.description].filter(Boolean).join("\n"), id, selection);
      if (active === current.current && owner === cachedAccountId()) { setSent(previous => new Set([...previous, peer.id])); Toast.show({ type: "success", text1: "已分享" }); }
    } catch (cause) { if (active === current.current) Toast.show({ type: "error", text1: "分享未完成，点击可重试", text2: cause instanceof Error ? cause.message : "请重试" }); }
    finally { sendingRef.current = false; setSending(undefined); }
  }
  async function action(channel: "community" | "copy" | "system") {
    const active = current.current;
    if (!active) return;
    try {
      if (channel === "community") {
        if (!cachedAccountId() && !await requireAccount() || active !== current.current) return;
        sheet.current?.dismiss();
        composeApplicationShare({ body: active.input.description || active.input.title || "", application: { appId: active.appId, params: active.input.params } });
        return;
      }
      const manifest = runningApplication(active.appId);
      const message = createShareText({ kind: "application", id: active.appId, params: active.input.params }, [active.input.title || manifest?.appName || "生花应用", active.input.description].filter(Boolean).join("\n"));
      if (channel === "copy") { Clipboard.setString(message); Toast.show({ type: "success", text1: "链接已复制" }); sheet.current?.dismiss(); }
      else await Share.share({ message, title: active.input.title || manifest?.appName });
    } catch (cause) { Toast.show({ type: "error", text1: "分享未完成", text2: cause instanceof Error ? cause.message : "请重试" }); }
  }
  return <BottomSheetModal ref={sheet} snapPoints={["48%", "82%"]} enableDynamicSizing={false} keyboardBehavior="interactive" keyboardBlurBehavior="restore" android_keyboardInputMode="adjustPan"
    onDismiss={() => { current.current = undefined; ++listRevision.current; setRequest(undefined); }}
    backdropComponent={props => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />}
    backgroundStyle={{ backgroundColor: colors.canvas, borderRadius: 24 }} handleIndicatorStyle={{ backgroundColor: colors.lineStrong }}>
    {friends ? <><View style={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }}>
      <Text style={{ color: colors.ink1, fontSize: 18, fontWeight: "700" }}>分享给好友</Text>
      <View style={{ flexDirection: "row", gap: 12 }}>{(["recent", "following"] as const).map(value => <Pressy key={value} onPress={() => void loadPeople(value)} style={{ padding: 10, borderRadius: 14, backgroundColor: kind === value ? colors.accent : colors.surface }}><Text style={{ color: kind === value ? colors.onAccent : colors.ink1 }}>{value === "recent" ? "最近聊天" : "我关注的"}</Text></Pressy>)}</View>
      <BottomSheetTextInput accessibilityLabel="搜索已加载的好友" value={query} onChangeText={setQuery} placeholder="搜索已加载的好友" placeholderTextColor={colors.ink3} style={{ color: colors.ink1, padding: 12, borderRadius: 16, backgroundColor: colors.surfaceRaised }} />
    </View><AnimatedFlashList data={people.filter(person => person.name.toLowerCase().includes(query.toLowerCase()))} renderScrollComponent={Scrollable} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom + 20 }}
      renderItem={({ item }) => <Pressy disabled={!!sending || sent.has(item.id)} onPress={() => void send(item)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}><UserAvatar uri={item.avatarUrl} authorId={item.id} size={40} /><Text style={{ flex: 1, color: colors.ink1 }}>{item.name}</Text>{sending === item.id ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accent }}>{sent.has(item.id) ? "已发送" : "发送"}</Text>}</Pressy>}
      ListEmptyComponent={loading ? <PageSkeleton rows={4} shape="picker" /> : <Text style={{ color: colors.ink3, textAlign: "center", padding: 32 }}>{error || (user ? "暂无可分享的好友" : "登录后可分享给好友")}</Text>}
      ListFooterComponent={<View>{error ? <Pressy onPress={() => void loadPeople(kind)} style={{ padding: 14 }}><Text style={{ color: colors.danger }}>{error} · 重试</Text></Pressy> : null}{cursor ? <Pressy disabled={loading} onPress={() => void loadPeople(kind, true)} style={{ padding: 14 }}><Text style={{ color: colors.ink3, textAlign: "center" }}>{loading ? "加载中…" : "加载更多"}</Text></Pressy> : !user ? <Pressy onPress={() => void requireAccount()} style={{ padding: 14 }}><Text style={{ color: colors.accent }}>登录</Text></Pressy> : null}</View>} />
    </> : <BottomSheetView style={{ padding: 20, paddingBottom: bottom + 20, gap: 12 }}>
      <Text numberOfLines={1} style={{ color: colors.ink1, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>{request?.input.title || (request ? runningApplication(request.appId)?.appName : undefined) || "分享应用"}</Text>
      {(["好友", "社区动态", "复制链接", "系统分享"] as const).map((label, index) => <Pressy key={label} onPress={() => { if (!index) void chooseFriends(); else void action((["community", "copy", "system"] as const)[index - 1]); }} accessibilityRole="button" accessibilityLabel={label} style={{ padding: 14, borderRadius: 16, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 12 }}><SymbolIcon name={(["chat", "feed", "layers", "share"] as const)[index]} size={22} color={colors.ink1} /><Text style={{ color: colors.ink1, fontSize: 15 }}>{label}</Text></Pressy>)}
    </BottomSheetView>}
  </BottomSheetModal>;
}
