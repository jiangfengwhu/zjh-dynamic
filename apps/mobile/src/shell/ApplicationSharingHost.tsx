import { useEventCallback } from "./useEventCallback";
import { useKeyboardMode } from "../../../../packages/ui/keyboard";
import { setPostSharingHandler } from "./sharePanel";
import type { UserPost } from "./feed/userPosts";
import { memo, useCallback, useMemo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Keyboard, Share, View } from "react-native";
import Clipboard from "@react-native-clipboard/clipboard";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetTextInput, useBottomSheetScrollableCreator } from "@gorhom/bottom-sheet";
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

type ShareRequest = { appId: string; input: ApplicationShareInput; post?: UserPost; id: number };
type Recipient = PublicAuthor & { recent?: boolean };
type Selection = { appId: string; releaseId: string; params?: ApplicationShareInput["params"] };
export function ApplicationSharingHost() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { user } = useAccount();
  const sheet = useRef<BottomSheetModal>(null);
  const [request, setRequest] = useState<ShareRequest>();
  useKeyboardMode("resize", !!request);
  const current = useRef<ShareRequest | undefined>(undefined);
  const sequence = useRef(0);
  const [people, setPeople] = useState<Recipient[]>([]);
  const cursors = useRef<{ recent?: string | null; following?: string | null }>({});
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const sendIds = useRef(new Map<string, string>());
  const sendingRef = useRef(false);
  const selections = useRef(new Map<string, Selection>());
  const listRevision = useRef(0);
  const Scrollable = useBottomSheetScrollableCreator();
  useEffect(() => {
    const open = async (appId: string, input: ApplicationShareInput, post?: UserPost) => {
      const next = { appId, input, post, id: ++sequence.current };
      current.current = next; ++listRevision.current;
      setRequest(next); setPeople([]); cursors.current = {}; setMore(false); setQuery(""); setError("");
      setSelected(new Set()); setSent(new Set()); setLoading(false); loadingRef.current = false; sendIds.current.clear(); selections.current.clear();
    };
    setApplicationSharingHandler(open);
    setPostSharingHandler(post => open(post.id, { title: `${post.author.name}的动态`, description: post.body || "分享动态" }, post));
    return () => { setPostSharingHandler(async () => { throw new Error("分享入口尚未就绪"); }); current.current = undefined; ++listRevision.current; setApplicationSharingHandler(async () => { throw new Error("分享入口尚未就绪"); }); };
  }, []);
  useLayoutEffect(() => { if (request) sheet.current?.present(); }, [request]);
  useEffect(() => { if (request && cachedAccountId()) void loadPeople(); }, [request]);
  useEffect(() => { sheet.current?.dismiss(); current.current = undefined; ++listRevision.current; }, [user?.id]);
  useEffect(() => {
    if (!request) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { sheet.current?.dismiss(); return true; });
    return () => subscription.remove();
  }, [request]);
  async function loadPeople(append = false) {
    const owner = cachedAccountId();
    if (!owner || loadingRef.current) return;
    const version = ++listRevision.current;
    loadingRef.current = true; setLoading(true); setError("");
    if (!append) cursors.current = {};
    const results = await Promise.allSettled([
      append && cursors.current.recent === null ? Promise.resolve(undefined) : readInbox(cursors.current.recent ?? undefined),
      append && cursors.current.following === null ? Promise.resolve(undefined) : readRelations(owner, "following", cursors.current.following ?? undefined),
    ]);
    if (version !== listRevision.current || owner !== cachedAccountId()) return;
    const items: Recipient[] = [];
    let failure = "";
    const recent = results[0], following = results[1];
    if (recent.status === "fulfilled" && recent.value) { items.push(...recent.value.conversations.map(item => ({ ...item.peer, recent: true }))); cursors.current.recent = recent.value.nextCursor; }
    else if (recent.status === "rejected") failure = recent.reason instanceof Error ? recent.reason.message : "最近聊天加载失败";
    if (following.status === "fulfilled" && following.value) { items.push(...following.value.authors.map(item => item.author)); cursors.current.following = following.value.nextCursor; }
    else if (following.status === "rejected") failure ||= following.reason instanceof Error ? following.reason.message : "关注列表加载失败";
    setPeople(previous => {
      const merged = new Map((append ? previous : []).map(item => [item.id, item]));
      for (const item of items) merged.set(item.id, { ...item, recent: item.recent || merged.get(item.id)?.recent });
      return [...merged.values()];
    });
    setMore(cursors.current.recent !== null || cursors.current.following !== null); setError(failure); setLoading(false); loadingRef.current = false;
  }
  function toggle(id: string) {
    if (sendingRef.current || sent.has(id)) return;
    setSelected(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  async function sendSelected() {
    const active = current.current, owner = cachedAccountId();
    if (!active || !owner || sendingRef.current || !selected.size) return;
    Keyboard.dismiss(); sendingRef.current = true; setSending(true);
    let failure = "", success = 0;
    try {
      let fresh: Selection | undefined;
      for (const peerId of selected) {
        if (owner !== cachedAccountId() || active !== current.current) return;
        let id = sendIds.current.get(peerId);
        if (!id) { id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`; sendIds.current.set(peerId, id); }
        try {
          let selection = selections.current.get(peerId);
          if (!selection && !active.post) {
            if (!fresh) { const application = await fetchMarketDetail(active.appId, { immediate: true }); fresh = { appId: active.appId, releaseId: application.manifest.releaseId, params: active.input.params }; }
            if (owner !== cachedAccountId() || active !== current.current) return;
            selection = fresh; selections.current.set(peerId, selection);
          }
          await sendMessage(peerId, "", id, selection, active.post?.id);
          if (active !== current.current || owner !== cachedAccountId()) return;
          success++; setSent(previous => new Set([...previous, peerId]));
          setSelected(previous => { const next = new Set(previous); next.delete(peerId); return next; });
        } catch (cause) { failure = cause instanceof Error ? cause.message : "请重试"; }
      }
      if (active === current.current) Toast.show(failure ? { type: "error", text1: success ? `已发送 ${success} 位，其他好友可重试` : "分享未完成，可重试", text2: failure } : { type: "success", text1: "已分享" });
    } finally { sendingRef.current = false; setSending(false); }
  }
  async function action(channel: "community" | "copy" | "system") {
    const active = current.current;
    if (!active || sendingRef.current) return;
    Keyboard.dismiss();
    try {
      if (channel === "community") {
        if (active.post) return;
        if (!cachedAccountId() && !await requireAccount() || active !== current.current) return;
        sheet.current?.dismiss();
        composeApplicationShare({ body: "", application: { appId: active.appId, params: active.input.params } });
        return;
      }
      const manifest = runningApplication(active.appId);
      const message = createShareText(active.post ? { kind: "post", id: active.post.id } : { kind: "application", id: active.appId, params: active.input.params }, [active.input.title || manifest?.appName || "生花应用", active.input.description].filter(Boolean).join("\n"));
      if (channel === "copy") { Clipboard.setString(message); Toast.show({ type: "success", text1: "链接已复制" }); sheet.current?.dismiss(); }
      else await Share.share({ message, title: active.input.title || manifest?.appName });
    } catch (cause) { Toast.show({ type: "error", text1: "分享未完成", text2: cause instanceof Error ? cause.message : "请重试" }); }
  }
  const toggleRecipient = useEventCallback(toggle);
  const backdrop = useCallback((props: Parameters<typeof BottomSheetBackdrop>[0]) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.32} pressBehavior="close" />, []);
  const rows = useMemo(() => { const search = query.trim().toLowerCase(); return search ? people.filter(person => person.name.toLowerCase().includes(search)) : people; }, [people, query]);
  const selectionState = useMemo(() => ({ selected, sent, sending }), [selected, sent, sending]);
  return <BottomSheetModal ref={sheet} snapPoints={["60%"]} enableDynamicSizing={false} enableOverDrag={false} keyboardBehavior="extend" keyboardBlurBehavior="restore" android_keyboardInputMode="adjustPan"
    onDismiss={() => { current.current = undefined; ++listRevision.current; setRequest(undefined); }}
    backdropComponent={backdrop}
    backgroundStyle={{ backgroundColor: colors.surface, borderRadius: colors.radius.xxl }} handleIndicatorStyle={{ width: 36, height: 4, backgroundColor: colors.lineStrong }}>
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", borderRadius: colors.radius.pill, backgroundColor: colors.surfaceRaised, paddingHorizontal: 16, gap: 10 }}>
          <SymbolIcon name="search" size={22} color={colors.ink3} />
          <BottomSheetTextInput accessibilityLabel="搜索好友" value={query} onChangeText={setQuery} placeholder="搜索好友" placeholderTextColor={colors.ink3} autoCorrect={false} style={{ flex: 1, color: colors.ink1, fontSize: 16, paddingVertical: 13 }} />
          {query ? <Pressy accessibilityLabel="清空搜索" onPress={() => setQuery("")} style={{ minWidth: 32, minHeight: 44, alignItems: "center", justifyContent: "center" }}><SymbolIcon name="close" size={16} color={colors.ink3} /></Pressy> : null}
        </View>
      </View>
      <AnimatedFlashList data={rows} extraData={selectionState} renderScrollComponent={Scrollable} keyExtractor={item => item.id} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 12 }}
        renderItem={({ item }) => <ShareRecipientRow item={item} selected={selected.has(item.id)} sent={sent.has(item.id)} sending={sending} toggle={toggleRecipient} />}
        ListEmptyComponent={loading ? <PageSkeleton rows={4} shape="picker" /> : <View style={{ minHeight: 160, justifyContent: "center", alignItems: "center", gap: 12 }}><Text style={{ color: colors.ink3 }}>{user ? query ? "没有找到好友" : "暂无可分享的好友" : "登录后可分享给好友"}</Text>{!user ? <Pressy onPress={() => void requireAccount()} style={{ padding: 12 }}><Text style={{ color: colors.accentText }}>登录</Text></Pressy> : null}</View>}
        ListFooterComponent={more || error ? <Pressy disabled={loading} onPress={() => void loadPeople(true)} style={{ padding: 14, alignItems: "center" }}>{loading ? <ActivityIndicator color={colors.ink3} /> : <Text style={{ color: error ? colors.danger : colors.ink3 }}>{error ? "加载未完成 · 重试" : "加载更多好友"}</Text>}</Pressy> : null} />
      <View style={{ borderTopWidth: colors.components.surfaceBorder, borderTopColor: colors.line, paddingTop: 18, paddingBottom: Math.max(bottom, 12), paddingHorizontal: 18, gap: 14 }}>
        {selected.size ? <Pressy accessibilityLabel={`发送给 ${selected.size} 位好友`} disabled={sending} onPress={() => void sendSelected()} style={{ minHeight: 44, borderRadius: colors.radius.pill, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}>{sending ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontSize: 15, fontWeight: "600" }}>发送给 {selected.size} 位好友</Text>}</Pressy> : null}
        <View style={{ flexDirection: "row" }}>{(request?.post ? ["system", "copy"] as const : ["system", "copy", "community"] as const).map((channel, index) => <Pressy key={channel} accessibilityRole="button" accessibilityLabel={(["系统分享", "复制链接", "社区动态"] as const)[index]} disabled={sending} onPress={() => void action(channel)} style={{ flex: 1, alignItems: "center", gap: 9, opacity: sending ? 0.45 : 1 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: index === 2 ? colors.accent : colors.ink1 }}><SymbolIcon name={(["share", "layers", "feed"] as const)[index]} size={24} strokeWidth={1.8} color={index === 2 ? colors.onAccent : colors.surface} /></View>
          <Text style={{ color: colors.ink1, fontSize: 12 }}>{(["分享…", "复制链接", "社区动态"] as const)[index]}</Text>
        </Pressy>)}</View>
      </View>
    </View>
  </BottomSheetModal>;
}

const ShareRecipientRow = memo(function ShareRecipientRow({ item, selected, sent, sending, toggle }: { item: Recipient; selected: boolean; sent: boolean; sending: boolean; toggle: (id: string) => void }) {
  const { colors } = useTheme();
  return <Pressy accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: sending || sent }} accessibilityLabel={`分享给 ${item.name}`} disabled={sending || sent} onPress={() => toggle(item.id)} style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 76, paddingVertical: 12 }}>
          <UserAvatar uri={item.avatarUrl} authorId={item.id} size={48} />
          <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={{ color: colors.ink1, fontSize: 16, fontWeight: "600" }}>{item.name}</Text><Text style={{ color: colors.ink3, fontSize: 13 }}>{sent ? "已发送" : item.recent ? "最近聊天" : "已关注"}</Text></View>
          <View style={{ width: 23, height: 23, borderRadius: 12, borderWidth: selected || sent ? 0 : 1.5, borderColor: colors.lineStrong, backgroundColor: selected || sent ? colors.accent : "transparent", alignItems: "center", justifyContent: "center" }}>{selected || sent ? <SymbolIcon name="check" size={14} strokeWidth={2.8} color={colors.onAccent} /> : null}</View>
        </Pressy>;
});
