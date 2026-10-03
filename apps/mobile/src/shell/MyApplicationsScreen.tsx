import { useAccount } from "./account";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, FlatList, RefreshControl, Text, TextInput, View } from "react-native";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { BackChip, Pressy, Surface } from "../../../../packages/ui/chrome";
import { Screen, ScreenBar } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { subscribeCatalog } from "./catalog";
import { installedMarket, fetchPublicMarketApplication, installMarketApplication, type MarketApplication } from "./market";
import { publicApplicationUpdates, validateApplication, type PublicApplicationUpdate } from "../runtime/applications";
import { openApplicationWorkshop } from "./workshopNavigation";
import { restoreWorks } from "./workRecovery";
import { readMyWorks, sharingLabel, workActions, workLabels, type MyWork } from "./works";

export function MyApplicationsScreen({ onBack, onCreate, onDetail, onOpen }: { onBack: () => void; onCreate: () => void; onDetail: (item: MarketApplication) => void; onOpen: (id: string) => void }) {
  const { user } = useAccount();
  const { colors } = useTheme(); const focused = useIsFocused();
  const [tab, setTab] = useState<"works" | "installed">("works");
  const [works, setWorks] = useState<MyWork[]>([]); const [installed, setInstalled] = useState<MarketApplication[]>([]);
  const [worksOwner, setWorksOwner] = useState<string>();
  const [pulling, setPulling] = useState(false);
  const [updates, setUpdates] = useState<Record<string, PublicApplicationUpdate>>({});
  const [updating, setUpdating] = useState(""); const updatingRef = useRef(false);
  usePreventRemove(Boolean(updating), () => Toast.show({ type: "info", text1: "正在下载应用更新，请稍候" }));
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [query, setQuery] = useState("");
  const generation = useRef(0); const refreshing = useRef(false);
  async function refresh(manual = false) {
    if (refreshing.current || AppState.currentState !== "active") return;
    setPulling(manual);
    const current = ++generation.current; refreshing.current = true; setBusy(true); setError("");
    try {
      const [local, apps] = await Promise.all([readMyWorks(), installedMarket()]);
      if (generation.current !== current) return;
      setWorks(local); setInstalled(apps); setWorksOwner(user?.id);
      const updateCheck = publicApplicationUpdates(manual).then(result => { if (generation.current === current) setUpdates(result); }).catch(() => { if (generation.current === current) setError("更新检查未完成，保留本机应用。下拉可重试。"); });
      await restoreWorks(manual, true);
      const updated = await readMyWorks();
      if (generation.current !== current) return;
      setWorks(updated);
      if (updated.some(work => work.stale)) setError("部分制作状态暂未接回，显示的是本机记录。下拉可重试。");
      await updateCheck;
    } catch { if (generation.current === current) setError("暂时无法读取作品，下拉可重试"); }
    finally { if (generation.current === current) { refreshing.current = false; setBusy(false); setPulling(false); } }
  }
  useEffect(() => { if (!focused) return; const subscription = AppState.addEventListener("change", state => { if (state === "active") void refresh(); }); return () => subscription.remove(); }, [focused, user?.id]);
  useEffect(() => { if (focused) void refresh(); return () => { generation.current++; refreshing.current = false; }; }, [focused, user?.id]);
  useEffect(() => { if (!focused) return; const timer = setInterval(() => { if (AppState.currentState === "active" && tab === "works" && works.some(work => ["making", "reply", "load", "blocked"].includes(work.stage)) && !refreshing.current) void refresh(); }, 30000); return () => clearInterval(timer); }, [focused, user?.id, tab, works]);
  useEffect(() => {
    const reload = () => { if (focused) void refresh(); };
    const offCatalog = subscribeCatalog(reload); const offSharing = subscribePackageValue("shell.market.changed", reload);
    const offWorkspaces = applicationContext("jolly").storage.subscribe("workspaces", reload);
    return () => { offCatalog(); offSharing(); offWorkspaces(); };
  }, [focused, user?.id]);
  async function workshop(work: MyWork) {
    try { await openApplicationWorkshop(work.appId, work.title, false, false); }
    catch (cause) { const message = cause instanceof Error ? cause.message : "工坊暂时无法打开，请重试"; setError(message); Toast.show({ type: "error", text1: "工坊未能打开", text2: message }); }
  }
  function detail(work: MyWork) { if (work.manifest) onDetail({ manifest: work.manifest, title: work.title, authorId: user?.id ?? null, authorName: user?.name ?? "社区创作者", authorAvatarUrl: user?.avatarUrl, originalAppId: null, owned: true }); }
  async function updateApplication(item: MarketApplication) {
    if (updatingRef.current) return;
    updatingRef.current = true; setUpdating(item.manifest.appId); setError("");
    try {
      // Re-read the public pointer when the user acts; cached badges are only hints.
      const published = await fetchPublicMarketApplication(item.manifest.appId);
      validateApplication(published.manifest);
      await installMarketApplication(published);
      Toast.show({ type: "success", text1: "应用已更新，本机数据保留" });
      void refresh(true);
    } catch (e) { const message = e instanceof Error ? e.message : "应用更新失败，请重试"; setError(message); Toast.show({ type: "error", text1: message }); }
    finally { updatingRef.current = false; setUpdating(""); }
  }
  async function installedDetail(item: MarketApplication) {
    if (updatingRef.current) return;
    if (item.owned || updates[item.manifest.appId]?.status === "private") { onDetail(item); return; }
    const request = generation.current;
    try { const published = await fetchPublicMarketApplication(item.manifest.appId); if (generation.current === request) onDetail(published); }
    catch { if (generation.current === request) onDetail(item); }
  }
  const term = query.trim().toLowerCase(); const visibleWorks = worksOwner === user?.id ? works.filter(work => `${work.title} ${work.wish}`.toLowerCase().includes(term)) : [];
  const workIds = new Set(works.map(work => work.appId)); const installedIds = new Set(installed.map(item => item.manifest.appId));
  const visibleApps = worksOwner === user?.id ? installed.filter(item => !workIds.has(item.manifest.appId) && `${item.manifest.title} ${item.manifest.summary}`.toLowerCase().includes(term)) : [];
  return <Screen style={styles.screen}><ScreenBar style={styles.header}><BackChip onPress={onBack} /><View style={{ flex: 1 }}><Text style={styles.title}>我的作品与应用</Text><Text style={styles.caption}>创作进度、分享和已安装应用</Text></View></ScreenBar>
    <View style={styles.tabs}>{([['works', '我创作的'], ['installed', '我安装的']] as const).map(([id, label]) => <Pressy key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[styles.tab, tab === id && { backgroundColor: colors.accentTint }]}><Text style={{ color: tab === id ? colors.accentText : colors.ink3 }}>{label}</Text></Pressy>)}</View>
    <FlatList<{ type: "work"; work: MyWork } | { type: "app"; app: MarketApplication }> data={tab === "works" ? visibleWorks.map(work => ({ type: "work" as const, work })) : visibleApps.map(app => ({ type: "app" as const, app }))} keyExtractor={row => row.type === "work" ? row.work.appId : row.app.manifest.appId} initialNumToRender={8} windowSize={7} removeClippedSubviews={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh(true)} tintColor={colors.accent} />} keyboardShouldPersistTaps="handled" ListHeaderComponent={<View style={{ gap: 12 }}>
      <TextInput accessibilityLabel="搜索我的作品与应用" value={query} onChangeText={setQuery} placeholder="搜索名称或心愿" placeholderTextColor={colors.ink3} style={styles.search} />
      {tab === "works" ? <Pressy onPress={onCreate}><Text style={styles.link}>＋ 创作新作品</Text></Pressy> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy && !works.length && !installed.length ? <ActivityIndicator color={colors.accent} /> : null}
      </View>}
      renderItem={({ item: row }) => { if (row.type === "work") { const work = row.work; return <View key={`work:${work.appId}`} style={styles.card}>
        <View style={styles.line}><Text style={[styles.name, { flex: 1 }]}>{work.title}</Text><Text style={styles.badge}>{workLabels[work.stage]}</Text></View>
        {work.wish ? <Text style={styles.copy} numberOfLines={2}>{work.wish}</Text> : null}
        <Text style={styles.caption}>{sharingLabel(work)}{work.stale ? " · 状态待刷新" : ""}</Text>
        <View style={styles.actions}><Pressy onPress={() => work.stage === "ready" && work.manifest ? detail(work) : void workshop(work)}><Text style={styles.link}>{workActions[work.stage]}</Text></Pressy>
          {work.manifest && work.stage !== "ready" ? <Pressy onPress={() => detail(work)}><Text style={styles.secondary}>作品详情与分享</Text></Pressy> : null}
          {installedIds.has(work.appId) ? <Pressy onPress={() => onOpen(work.appId)}><Text style={styles.secondary}>打开作品</Text></Pressy> : null}</View>
      </View>; } const item = row.app; return <View key={`installed:${item.manifest.appId}`} style={styles.card}>
        <View style={styles.line}><Text style={[styles.name, { flex: 1 }]}>{item.manifest.title}</Text>{updates[item.manifest.appId]?.status === "update" ? <Text style={styles.badge}>有新版</Text> : null}</View>
        <Text style={styles.copy}>{item.manifest.summary}</Text>
        <Text style={styles.caption}>{updates[item.manifest.appId]?.message || (updates[item.manifest.appId]?.status === "current" ? "已是当前公开版本" : "更新只使用作者公开发布的版本")}</Text>
        <View style={styles.actions}><Pressy disabled={Boolean(updating)} onPress={() => onOpen(item.manifest.appId)}><Text style={styles.link}>打开应用</Text></Pressy>
          {updates[item.manifest.appId]?.status === "update" ? <Pressy disabled={Boolean(updating)} onPress={() => void updateApplication(item)}><Text style={styles.link}>{updating === item.manifest.appId ? "正在下载更新…" : "更新应用"}</Text></Pressy> : null}
          <Pressy disabled={Boolean(updating)} onPress={() => void installedDetail(item)}><Text style={styles.secondary}>详情与卸载</Text></Pressy></View>
      </View>; }}
      ListEmptyComponent={!busy && !error ? <Text style={styles.caption}>{term ? "没有找到匹配的作品与应用" : tab === "works" ? "还没有创作作品，从一个小心愿开始吧。" : "还没有安装市场应用，去应用市场看看吧。"}</Text> : null}
    /></Screen>;
}
const styles = themedStyleSheet(t => ({ screen: { flex: 1, backgroundColor: t.canvas }, header: { paddingHorizontal: 12, paddingVertical: 2, flexDirection: "row", gap: 8, alignItems: "center", borderBottomWidth: 0.5, borderBottomColor: t.line }, title: { color: t.ink1, fontFamily: t.serif, fontSize: 19 }, caption: { color: t.ink3, fontSize: 12, lineHeight: 18 }, tabs: { flexDirection: "row", paddingHorizontal: 16, gap: 12 }, tab: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14 }, content: { padding: 16, gap: 8, paddingBottom: 16 }, search: { color: t.ink1, backgroundColor: t.field, padding: 16, borderRadius: 16 }, card: { paddingVertical: 12, gap: 6, borderBottomWidth: 0.5, borderBottomColor: t.line }, line: { flexDirection: "row", alignItems: "center", gap: 12 }, name: { color: t.ink1, fontSize: 15, fontWeight: "600" }, copy: { color: t.ink2, fontSize: 14, lineHeight: 22 }, badge: { color: t.accentText, fontSize: 12 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" }, link: { color: t.accentText, fontSize: 14, paddingVertical: 5 }, secondary: { color: t.ink3, fontSize: 13, paddingVertical: 5 }, error: { color: t.orangeText, fontSize: 13, lineHeight: 20 } }));
