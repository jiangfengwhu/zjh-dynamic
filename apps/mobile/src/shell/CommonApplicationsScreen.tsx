import { useEventCallback } from "./useEventCallback";
import { isWorkDeleted } from "./deletedWorkState";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { appendUnique } from "./listData";
import { memo, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
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
import { openCommonApplication } from "./navigation";
import { usePullToRefresh } from "./feed/pullToRefresh";
import { PullRefreshSurface } from "./feed/PullRefreshSurface";

type Page = { applications: CommonApplication[]; nextCursor: string | null };
export function CommonApplicationsScreen({ active = true }: { active?: boolean }) {
  const { colors: t } = useTheme();
  const { user } = useAccount();
  const owner = user?.id ?? "guest";
  const focused = useIsFocused() && active;
  const currentOwner = useRef(owner); currentOwner.current = owner;
  const cacheKey = pageCacheKey("common-applications");
  const cached = cachedPage<Page>(cacheKey);
  const [page, setPage] = useState(() => ({ owner, loaded: !!cached, applications: (cached?.applications ?? []).filter(item => !isWorkDeleted(item.appId)), nextCursor: cached?.nextCursor ?? null }));
  const [busy, setBusy] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState("");
  const reading = useRef(false);
  const writing = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const scrollY = useSharedValue(0);
  const trackScroll = useAnimatedScrollHandler(event => { scrollY.value = Math.max(0, event.contentOffset.y); });
  const refresh = usePullToRefresh({ scrollY, onRefresh: () => load() });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => subscribePackageValue("shell.works.changed", () => {
    setPage(prior => {
      const applications = prior.applications.filter(app => !isWorkDeleted(app.appId));
      return applications.length === prior.applications.length ? prior : { ...prior, applications };
    });
  }), []);
  async function load(more = false) {
    if (!focused || !user || writing.current || reading.current || (more && !page.nextCursor)) return false;
    reading.current = true; setBusy(true); setPaging(more); setError("");
    const token = generation.current;
    try {
      const result = await fetchCommonApplications(more ? page.nextCursor ?? undefined : undefined);
      if (!mounted.current || token !== generation.current || currentOwner.current !== owner) return false;
      setPage(prior => {
        const applications = (more && prior.owner === owner ? appendUnique(prior.applications, result.applications, item => item.appId) : result.applications).filter(item => !isWorkDeleted(item.appId));
        const shared = rememberPage(cacheKey, { applications, nextCursor: result.nextCursor });
        return prior.owner === owner && prior.loaded && prior.applications === shared.applications && prior.nextCursor === shared.nextCursor
          ? prior : { owner, loaded: true, ...shared };
      });
      return true;
    } catch (cause) { if (mounted.current && token === generation.current) setError(cause instanceof Error ? cause.message : "常用应用暂时无法加载"); return false; }
    finally { if (token === generation.current) { reading.current = false; if (mounted.current) { setBusy(false); setPaging(false); } } }
  }
  useEffect(() => {
    if (!focused) return;
    generation.current++; reading.current = false; setBusy(false); setPaging(false); setError("");
    const saved = cachedPage<Page>(pageCacheKey("common-applications"));
    setPage(prior => prior.owner === owner ? prior : { owner, loaded: !!saved, applications: (saved?.applications ?? []).filter(item => !isWorkDeleted(item.appId)), nextCursor: saved?.nextCursor ?? null });
    const cancel = afterInteractions(() => { void load(); });
    return () => { cancel(); generation.current++; };
  }, [owner, focused]);
  const open = useEventCallback((item: CommonApplication) => {
    void openCommonApplication(item.appId).catch(error => Toast.show({ type: "error", text1: "打开失败", text2: error.message }));
  });
  const remove = useEventCallback((item: CommonApplication) => {
    HostAlert.alert("从常用移除？", item.title, [{ text: "取消", style: "cancel" }, { text: "移除", style: "destructive", onPress: () => { void (async () => {
      if (writing.current || currentOwner.current !== owner || cachedAccountId() !== owner) return;
      writing.current = true;
      const removedIndex = page.applications.findIndex(app => app.appId === item.appId);
      generation.current++; reading.current = false; setBusy(false); setPaging(false);
      setPage(prior => ({ ...prior, applications: prior.applications.filter(app => app.appId !== item.appId) }));
      try {
        await saveApplicationDiscussion(item.discussionId, false);
        if (!mounted.current || currentOwner.current !== owner) return;
        generation.current++; reading.current = false; setBusy(false); setPaging(false);
        setPage(prior => {
          const next = { ...prior, applications: prior.applications.filter(app => app.appId !== item.appId) };
          rememberPage(cacheKey, { applications: next.applications, nextCursor: next.nextCursor });
          return next;
        });
        Toast.show({ type: "success", text1: "已从常用移除" });
      } catch (cause) { if (currentOwner.current === owner) {
        if (mounted.current) setPage(prior => {
          if (prior.applications.some(app => app.appId === item.appId)) return prior;
          const applications = [...prior.applications]; applications.splice(Math.max(0, removedIndex), 0, item);
          return { ...prior, applications };
        });
        Toast.show({ type: "error", text1: "移除未完成，已恢复", text2: cause instanceof Error ? cause.message : "请重试" });
      } }
      finally { writing.current = false; }
    })(); } }]);
  });
  const applications = page.owner === owner ? page.applications : [];
  return <View style={{ flex: 1 }}>
    {!user ? <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}><Text style={{ color: t.ink3 }}>登录后保存并同步常用应用</Text><Pressy onPress={() => void requireAccount()} style={{ padding: 12 }}><Text style={{ color: t.accentText }}>登录</Text></Pressy></View> :
      <PullRefreshSurface refresh={refresh}><AnimatedFlashList data={applications} keyExtractor={item => item.appId} numColumns={4} maintainVisibleContentPosition={{ disabled: true }} showsVerticalScrollIndicator={false}
        onScroll={trackScroll} scrollEventThrottle={16} bounces={false} overScrollMode="never" scrollEnabled={refresh.phase !== "refreshing" && refresh.phase !== "done"}
        onEndReached={() => { if (page.nextCursor && !error) void load(true); }} onEndReachedThreshold={0.3}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16, flexGrow: 1 }}
        ListEmptyComponent={!page.loaded && !error ? <PageSkeleton shape="grid" rows={3} animated={focused} /> : !error ? <View style={{ flex: 1, minHeight: 280, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }}><Text style={{ color: t.ink1, fontSize: 16, fontWeight: "700" }}>把喜欢的应用留下来</Text><Text style={{ color: t.ink3, textAlign: "center", lineHeight: 22 }}>在发现作品中点书签，就能在这里直接打开。</Text></View> : null}
        renderItem={({ item }) => <CommonApplicationTile item={item} open={open} remove={remove} />}
        ListFooterComponent={error ? <Pressy onPress={() => void load(!!applications.length && !!page.nextCursor)} style={{ padding: 20 }}><Text style={{ color: t.danger, textAlign: "center" }}>{error} · 点击重试</Text></Pressy> : page.nextCursor ? <Pressy disabled={busy} onPress={() => void load(true)} style={{ padding: 16 }}>{paging ? <ActivityIndicator color={t.ink3} /> : <Text style={{ color: t.ink3, textAlign: "center" }}>加载更多</Text>}</Pressy> : null} /></PullRefreshSurface>}
  </View>;
}

const CommonApplicationTile = memo(function CommonApplicationTile({ item, open, remove }: { item: CommonApplication; open: (item: CommonApplication) => void; remove: (item: CommonApplication) => void }) {
  const { colors: t } = useTheme();
  return <Pressy accessibilityRole="button" accessibilityLabel={`打开${item.title}，长按可移除`} onPress={() => void open(item)} onLongPress={() => remove(item)} style={{ alignItems: "center", gap: 7, paddingVertical: 16, paddingHorizontal: 6 }}>
          <View style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center" }}><ApplicationIcon application={{ manifest: { appId: item.appId, accent: item.accent, icon: item.icon }, iconUrl: item.iconUrl }} size={52} /></View>
          <Text numberOfLines={1} style={{ color: t.ink1, fontSize: 12, maxWidth: "100%" }}>{item.title}</Text>
        </Pressy>;
});
