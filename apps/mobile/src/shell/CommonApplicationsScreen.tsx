import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Pressy } from "../../../../packages/ui/chrome";
import { useTheme } from "../../../../packages/ui/theme";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { AnimatedFlashList } from "./AnimatedFlashList";
import { ApplicationIcon } from "./ApplicationIcon";
import { HostText as Text } from "./feed/HostText";
import { PageSkeleton } from "./LoadingSkeleton";
import { HostAlert } from "./HostAlert";
import { cachedAccountId, requireAccount, useAccount } from "./account";
import { cachedPage, pageCacheKey, rememberPage } from "./pageCache";
import { afterInteractions } from "./interactionWork";
import { fetchCommonApplications, saveApplicationDiscussion, type CommonApplication } from "./feed/userPosts";
import { fetchPublicMarketApplication } from "./market";
import { loadPublicApplicationExperience } from "../runtime/applications";

type Page = { applications: CommonApplication[]; nextCursor: string | null };
export function CommonApplicationsScreen({ onOpen, active = true }: { onOpen: (id: string) => Promise<boolean>; active?: boolean }) {
  const { colors: t } = useTheme();
  const { user } = useAccount();
  const owner = user?.id ?? "guest";
  const focused = useIsFocused() && active;
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const cacheKey = pageCacheKey("common-applications");
  const cached = cachedPage<Page>(cacheKey);
  const [page, setPage] = useState(() => ({ owner, loaded: !!cached, applications: cached?.applications ?? [], nextCursor: cached?.nextCursor ?? null }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState("");
  const reading = useRef(false);
  const writing = useRef(false);
  const generation = useRef(0);
  const openTask = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function load(more = false) {
    if (!focused || !user || reading.current || (more && !page.nextCursor)) return;
    reading.current = true; setBusy(true); setError("");
    const token = generation.current;
    try {
      const result = await fetchCommonApplications(more ? page.nextCursor ?? undefined : undefined);
      if (!mounted.current || token !== generation.current || currentOwner.current !== owner) return;
      setPage(prior => {
        const applications = more && prior.owner === owner ? [...new Map([...prior.applications, ...result.applications].map(item => [item.appId, item])).values()] : result.applications;
        rememberPage(cacheKey, { applications, nextCursor: result.nextCursor });
        return { owner, loaded: true, applications, nextCursor: result.nextCursor };
      });
    } catch (cause) { if (mounted.current && token === generation.current) setError(cause instanceof Error ? cause.message : "常用应用暂时无法加载"); }
    finally { if (token === generation.current) { reading.current = false; if (mounted.current) setBusy(false); } }
  }
  useEffect(() => {
    if (!focused) return;
    generation.current++; reading.current = false; setBusy(false); setError(""); setOpening("");
    const saved = cachedPage<Page>(pageCacheKey("common-applications"));
    setPage({ owner, loaded: !!saved, applications: saved?.applications ?? [], nextCursor: saved?.nextCursor ?? null });
    const cancel = afterInteractions(() => { void load(); });
    return () => { cancel(); generation.current++; openTask.current?.abort(); openTask.current = null; };
  }, [owner, focused]);
  async function open(item: CommonApplication) {
    if (openTask.current) return;
    const controller = new AbortController(); openTask.current = controller; setOpening(item.appId);
    try {
      const application = await fetchPublicMarketApplication(item.appId);
      controller.signal.throwIfAborted();
      if (currentOwner.current !== owner) return;
      await loadPublicApplicationExperience(application.manifest, controller.signal);
      controller.signal.throwIfAborted();
      if (currentOwner.current === owner && !await onOpen(item.appId)) throw new Error("暂时无法打开，请重试");
    } catch (cause) { if (!controller.signal.aborted && currentOwner.current === owner) Toast.show({ type: "error", text1: "应用未能打开", text2: cause instanceof Error ? cause.message : "请重试" }); }
    finally { if (openTask.current === controller) { openTask.current = null; if (mounted.current) setOpening(""); } }
  }
  function remove(item: CommonApplication) {
    HostAlert.alert("从常用移除？", item.title, [{ text: "取消", style: "cancel" }, { text: "移除", style: "destructive", onPress: () => { void (async () => {
      if (writing.current || currentOwner.current !== owner || cachedAccountId() !== owner) return;
      writing.current = true;
      try {
        await saveApplicationDiscussion(item.discussionId, false);
        if (!mounted.current || currentOwner.current !== owner) return;
        generation.current++; reading.current = false; setBusy(false);
        setPage(prior => {
          const next = { ...prior, applications: prior.applications.filter(app => app.appId !== item.appId) };
          rememberPage(cacheKey, { applications: next.applications, nextCursor: next.nextCursor });
          return next;
        });
        Toast.show({ type: "success", text1: "已从常用移除" });
      } catch (cause) { if (mounted.current && currentOwner.current === owner) Toast.show({ type: "error", text1: "移除未完成", text2: cause instanceof Error ? cause.message : "请重试" }); }
      finally { writing.current = false; }
    })(); } }]);
  }
  const applications = page.owner === owner ? page.applications : [];
  return <View style={{ flex: 1 }}>
    {!user ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}><Text style={{ color: t.ink3 }}>登录后保存并同步常用应用</Text><Pressy onPress={() => void requireAccount()} style={{ padding: 12 }}><Text style={{ color: t.accentText }}>登录</Text></Pressy></View> :
      <AnimatedFlashList data={applications} keyExtractor={item => item.appId} numColumns={4} maintainVisibleContentPosition={{ disabled: true }} showsVerticalScrollIndicator={false}
        refreshing={busy && page.loaded} onRefresh={() => void load()} onEndReached={() => { if (page.nextCursor && !error) void load(true); }} onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16, flexGrow: 1 }}
        ListEmptyComponent={!page.loaded && !error ? <PageSkeleton shape="grid" rows={3} animated={focused} /> : !error ? <View style={{ flex: 1, minHeight: 280, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }}><Text style={{ color: t.ink1, fontSize: 16, fontWeight: "700" }}>把喜欢的应用留下来</Text><Text style={{ color: t.ink3, textAlign: "center", lineHeight: 22 }}>在发现作品中点书签，就能在这里直接打开。</Text></View> : null}
        renderItem={({ item }) => <Pressy accessibilityRole="button" accessibilityLabel={`打开${item.title}，长按可移除`} disabled={!!opening} onPress={() => void open(item)} onLongPress={() => remove(item)} style={{ alignItems: "center", gap: 7, paddingVertical: 16, paddingHorizontal: 6 }}>
          <View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}><ApplicationIcon application={{ manifest: { appId: item.appId, accent: item.accent, icon: item.icon }, iconUrl: item.iconUrl }} size={52} />{opening === item.appId ? <View style={{ position: "absolute", inset: 0, borderRadius: 14, backgroundColor: t.surfaceRaised, opacity: 0.85, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={t.accent} /></View> : null}</View>
          <Text numberOfLines={1} style={{ color: t.ink1, fontSize: 12, maxWidth: "100%" }}>{item.title}</Text>
        </Pressy>}
        ListFooterComponent={error ? <Pressy onPress={() => void load(!!applications.length && !!page.nextCursor)} style={{ padding: 20 }}><Text style={{ color: t.danger, textAlign: "center" }}>{error} · 点击重试</Text></Pressy> : page.nextCursor ? <Pressy disabled={busy} onPress={() => void load(true)} style={{ padding: 16 }}>{busy ? <ActivityIndicator color={t.ink3} /> : <Text style={{ color: t.ink3, textAlign: "center" }}>加载更多</Text>}</Pressy> : null} />}
  </View>;
}
