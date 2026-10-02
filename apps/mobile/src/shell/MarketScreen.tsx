import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { BackChip, Icon, Pressy, Surface } from "../../../../packages/ui/chrome";
import { Screen, ScreenBar } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { loadCatalog, subscribeCatalog } from "./catalog";
import { cachedMarket, fetchMarket, marketDefinition, type MarketApplication } from "./market";
export function MarketScreen({ onDetail, onCreate, onBack, onAuthor }: { onAuthor: (author: { id: string; name: string; avatarUrl: string | null; official?: boolean }) => void; onDetail: (item: MarketApplication) => void; onCreate: () => void; onBack?: () => void }) {
  const { colors } = useTheme();
  const focused = useIsFocused();
  const [items, setItems] = useState<MarketApplication[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const generation = useRef(0); const loading = useRef(false);
  const [error, setError] = useState("");
  async function refresh(manual = false) {
    if (loading.current) return;
    loading.current = true; const current = ++generation.current;
    setPulling(manual); setBusy(true); setError("");
    try {
      const cached = await cachedMarket();
      if (generation.current !== current) return;
      setItems(items => items.length ? items : cached);
      const remote = await fetchMarket();
      if (generation.current === current) setItems(remote);
    } catch (e) { if (generation.current === current) setError(e instanceof Error ? e.message : "暂时无法获取应用市场"); }
    finally { if (generation.current === current) { loading.current = false; setBusy(false); setPulling(false); } }
  }
  useEffect(() => {
    const update = (entries: Awaited<ReturnType<typeof loadCatalog>>) => setInstalled(entries.filter(entry => !entry.trashedAt && !entry.purged).map(entry => entry.id));
    void loadCatalog().then(update); return subscribeCatalog(update);
  }, []);
  useEffect(() => { if (focused) void refresh(); return () => { generation.current++; loading.current = false; }; }, [focused]);
  useEffect(() => subscribePackageValue("shell.market.changed", () => { if (focused) void refresh(); }), [focused]);
  const visible = items.filter(item => `${item.title || item.manifest.title} ${item.summary || item.manifest.summary}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Screen style={styles.screen}>
    <ScreenBar style={styles.header}>{onBack ? <BackChip onPress={onBack} /> : null}<View style={{ flex: 1 }}><Text style={styles.title}>应用市场</Text><Text style={styles.caption}>找一个喜欢的应用，从这里开始</Text></View></ScreenBar>
    <ScrollView removeClippedSubviews={false} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh(true)} tintColor={colors.accent} />} keyboardShouldPersistTaps="handled">
      <TextInput accessibilityLabel="搜索应用" placeholder="搜索应用或用途" placeholderTextColor={colors.ink3} value={query} onChangeText={setQuery} style={styles.search} />
      {<Pressy onPress={onCreate} accessibilityRole="button"><Surface tone="raised" radius={20} style={styles.invite}><Icon name="workshop" size={23} color={colors.accent} /><View style={{ flex: 1, gap: 4 }}><Text style={styles.name}>让 Jolly 帮我做一个</Text><Text style={styles.caption}>有想法了？去 Jolly 的工坊聊聊</Text></View><Icon name="chevron" size={16} color={colors.ink3} /></Surface></Pressy>}
      {error ? <Pressy onPress={() => void refresh()}><Text style={styles.error}>{error} · 点此重试</Text></Pressy> : null}
      {busy && !items.length ? <ActivityIndicator color={colors.accent} /> : null}
      {visible.map(item => { const app = item.manifest; const Avatar = marketDefinition(item)?.avatar; return <Pressy key={app.appId} accessibilityRole="button" accessibilityLabel={`查看${app.title}`} onPress={() => onDetail(item)}><View style={styles.row}><View style={[styles.mark, { backgroundColor: `${app.accent}18` }]}>{Avatar ? <Avatar size={52} /> : <Text style={{ fontSize: 25, color: app.accent }}>{app.mark}</Text>}</View><View style={{ flex: 1, gap: 5 }}><Text style={styles.name}>{item.title || app.title}</Text><Text style={styles.summary} numberOfLines={2}>{item.summary || app.summary}</Text><Pressy disabled={!item.authorId} accessibilityLabel={`查看${item.authorName}的主页`} onPress={event => { event.stopPropagation(); if (item.authorId) onAuthor({ id: item.authorId, name: item.authorName, avatarUrl: item.authorAvatarUrl ?? null, official: item.authorOfficial }); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}>{item.authorAvatarUrl ? <Image source={{ uri: item.authorAvatarUrl }} style={{ width: 18, height: 18, borderRadius: 9 }} /> : null}<Text style={styles.caption}>{item.authorName || "社区创作者"}</Text>{item.authorOfficial ? <Text accessibilityLabel="官方发布" style={styles.official}>官方</Text> : null}</Pressy></View><Text style={styles.badge}>{installed.includes(app.appId) ? "已安装" : "查看"}</Text></View></Pressy>; })}
      {!busy && !visible.length ? <Text style={styles.empty}>{query ? "没有找到匹配的应用，换个关键词试试" : "应用正在准备中，稍后再来看看"}</Text> : null}
    </ScrollView>
  </Screen>;
}
const styles = themedStyleSheet(t => ({ screen: { flex: 1, backgroundColor: t.canvas }, header: { padding: 20, gap: 12, alignItems: "center", flexDirection: "row" }, title: { fontSize: 26, fontFamily: t.serif, fontWeight: "700", color: t.ink1 }, caption: { fontSize: 12, lineHeight: 18, color: t.ink3 }, content: { paddingHorizontal: 20, paddingBottom: 36, gap: 18 }, search: { color: t.ink1, backgroundColor: t.field, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15 }, invite: { padding: 16, gap: 12, flexDirection: "row", alignItems: "center" }, row: { flexDirection: "row", gap: 14, alignItems: "center", paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: t.line }, mark: { width: 52, height: 52, borderRadius: 17, alignItems: "center", justifyContent: "center", overflow: "hidden" }, name: { color: t.ink1, fontSize: 17, fontWeight: "600" }, summary: { color: t.ink2, fontSize: 13, lineHeight: 20 }, official: { color: t.accentText, backgroundColor: t.accentTint, fontSize: 10, fontWeight: "600", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, overflow: "hidden" }, badge: { color: t.accentText, fontSize: 12 }, error: { color: t.orangeText, fontSize: 13, lineHeight: 20 }, empty: { color: t.ink3, textAlign: "center", paddingVertical: 40 } }));
