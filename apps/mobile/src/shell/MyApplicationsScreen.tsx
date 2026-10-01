import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { BackChip, Pressy, Surface } from "../../../../packages/ui/chrome";
import { Screen, ScreenBar } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { subscribeCatalog } from "./catalog";
import { installedMarket, type MarketApplication } from "./market";
import { openApplicationWorkshop } from "./workshopNavigation";
import { readMyWorks, refreshMyWork, sharingLabel, workActions, workLabels, type MyWork } from "./works";

export function MyApplicationsScreen({ onBack, onCreate, onDetail, onOpen }: { onBack: () => void; onCreate: () => void; onDetail: (item: MarketApplication) => void; onOpen: (id: string) => void }) {
  const { colors } = useTheme(); const focused = useIsFocused();
  const [tab, setTab] = useState<"works" | "installed">("works");
  const [works, setWorks] = useState<MyWork[]>([]); const [installed, setInstalled] = useState<MarketApplication[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [query, setQuery] = useState("");
  const generation = useRef(0); const refreshing = useRef(false);
  async function refresh() {
    const current = ++generation.current; refreshing.current = true; setBusy(true); setError("");
    try {
      const [local, apps] = await Promise.all([readMyWorks(), installedMarket()]);
      if (generation.current !== current) return;
      setWorks(local); setInstalled(apps);
      const updated: MyWork[] = [];
      for (const work of local) { if (generation.current !== current) return; updated.push(await refreshMyWork(work)); }
      if (generation.current !== current) return;
      setWorks(updated);
      if (updated.some(work => work.stale)) setError("部分制作状态暂未接回，显示的是本机记录。下拉可重试。");
    } catch { if (generation.current === current) setError("暂时无法读取作品，下拉可重试"); }
    finally { if (generation.current === current) { refreshing.current = false; setBusy(false); } }
  }
  useEffect(() => { if (focused) void refresh(); return () => { generation.current++; }; }, [focused]);
  useEffect(() => { if (!focused) return; const timer = setInterval(() => { if (!refreshing.current) void refresh(); }, 30000); return () => clearInterval(timer); }, [focused]);
  useEffect(() => {
    const reload = () => { if (focused) void refresh(); };
    const offCatalog = subscribeCatalog(reload); const offSharing = subscribePackageValue("shell.market.changed", reload);
    const offWorkspaces = applicationContext("jolly").storage.subscribe("workspaces", reload);
    return () => { offCatalog(); offSharing(); offWorkspaces(); };
  }, [focused]);
  function detail(work: MyWork) { if (work.manifest) onDetail({ manifest: work.manifest, title: work.title, authorId: null, authorName: "社区创作者", originalAppId: null, owned: true }); }
  const term = query.trim().toLowerCase(); const visibleWorks = works.filter(work => `${work.title} ${work.wish}`.toLowerCase().includes(term));
  const visibleApps = installed.filter(item => !works.some(work => work.appId === item.manifest.appId) && `${item.manifest.title} ${item.manifest.summary}`.toLowerCase().includes(term));
  return <Screen style={styles.screen}><ScreenBar style={styles.header}><BackChip onPress={onBack} /><View style={{ flex: 1 }}><Text style={styles.title}>我的作品与应用</Text><Text style={styles.caption}>创作进度、分享和已安装应用</Text></View></ScreenBar>
    <View style={styles.tabs}>{([['works', '我创作的'], ['installed', '我安装的']] as const).map(([id, label]) => <Pressy key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[styles.tab, tab === id && { backgroundColor: colors.accentTint }]}><Text style={{ color: tab === id ? colors.accentText : colors.ink3 }}>{label}</Text></Pressy>)}</View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void refresh()} tintColor={colors.accent} />} keyboardShouldPersistTaps="handled">
      <TextInput accessibilityLabel="搜索我的作品与应用" value={query} onChangeText={setQuery} placeholder="搜索名称或心愿" placeholderTextColor={colors.ink3} style={styles.search} />
      {tab === "works" ? <Pressy onPress={onCreate}><Text style={styles.link}>＋ 创作新作品</Text></Pressy> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {busy && !works.length && !installed.length ? <ActivityIndicator color={colors.accent} /> : null}
      {tab === "works" ? visibleWorks.map(work => <Surface key={work.appId} radius={20} style={styles.card}>
        <View style={styles.line}><Text style={[styles.name, { flex: 1 }]}>{work.title}</Text><Text style={styles.badge}>{workLabels[work.stage]}</Text></View>
        {work.wish ? <Text style={styles.copy} numberOfLines={2}>{work.wish}</Text> : null}
        <Text style={styles.caption}>{sharingLabel(work)}{work.stale ? " · 状态待刷新" : ""}</Text>
        <View style={styles.actions}><Pressy onPress={() => work.stage === "accepted" && work.manifest ? detail(work) : openApplicationWorkshop(work.appId, work.title, false, false)}><Text style={styles.link}>{workActions[work.stage]}</Text></Pressy>
          {work.manifest && work.stage !== "accepted" ? <Pressy onPress={() => detail(work)}><Text style={styles.secondary}>作品详情与分享</Text></Pressy> : null}
          {installed.some(item => item.manifest.appId === work.appId) ? <Pressy onPress={() => onOpen(work.appId)}><Text style={styles.secondary}>打开作品</Text></Pressy> : null}</View>
      </Surface>) : visibleApps.map(item => <Pressy key={item.manifest.appId} onPress={() => onDetail(item)}><Surface radius={20} style={styles.card}><Text style={styles.name}>{item.manifest.title}</Text><Text style={styles.copy}>{item.manifest.summary}</Text><Text style={styles.link}>打开详情 · 更新与卸载</Text></Surface></Pressy>)}
      {!busy && !(tab === "works" ? visibleWorks.length : visibleApps.length) ? <Text style={styles.caption}>{term ? "没有找到匹配的作品" : tab === "works" ? "还没有创作作品，从一个小心愿开始吧。" : "还没有安装市场应用，去应用市场看看吧。"}</Text> : null}
    </ScrollView></Screen>;
}
const styles = themedStyleSheet(t => ({ screen: { flex: 1, backgroundColor: t.canvas }, header: { padding: 20, flexDirection: "row", gap: 12, alignItems: "center" }, title: { color: t.ink1, fontFamily: t.serif, fontSize: 23 }, caption: { color: t.ink3, fontSize: 13, lineHeight: 20 }, tabs: { flexDirection: "row", paddingHorizontal: 20, gap: 12 }, tab: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 }, content: { padding: 20, gap: 18, paddingBottom: 40 }, search: { color: t.ink1, backgroundColor: t.field, padding: 16, borderRadius: 16 }, card: { padding: 20, gap: 12 }, line: { flexDirection: "row", alignItems: "center", gap: 12 }, name: { color: t.ink1, fontSize: 18, fontWeight: "600" }, copy: { color: t.ink2, fontSize: 14, lineHeight: 22 }, badge: { color: t.accentText, fontSize: 12 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 20, alignItems: "center" }, link: { color: t.accentText, fontSize: 14, paddingVertical: 5 }, secondary: { color: t.ink3, fontSize: 13, paddingVertical: 5 }, error: { color: t.orangeText, fontSize: 13, lineHeight: 20 } }));
