import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import FastImage from "@d11/react-native-fast-image";
import { Search, ArrowUpRight } from "lucide-react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import { BackChip, Icon, Pressy } from "../../../../packages/ui/chrome";
import { Screen, ScreenBar } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { loadCatalog, subscribeCatalog } from "./catalog";
import { readShellValue, writeShellValue } from "./shellStorage";
import { fetchMarketPage, fetchPublicMarketApplication, readMarketView, rememberMarketView, marketViewKey, marketCategories, marketDefinition, type MarketView, type MarketApplication } from "./market";
const empty: MarketView = { applications: [], at: 0, offset: 0 };
export function MarketScreen({ onDetail, onCreate, onBack, onAuthor }: { onAuthor: (author: { id: string; name: string; avatarUrl: string | null; official?: boolean }) => void; onDetail: (item: MarketApplication) => void; onCreate: () => void; onBack?: () => void }) {
  const { colors } = useTheme(); const focused = useIsFocused();
  const [view, setView] = useState<MarketView>(empty); const [installed, setInstalled] = useState<string[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState(""); const [search, setSearch] = useState(""); const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false); const [pulling, setPulling] = useState(false); const [error, setError] = useState("");
  const [ready, setReady] = useState(false); const edited = useRef(false);
  const opening = useRef(false); const [openingId, setOpeningId] = useState<string>();
  const retryDetail = useRef<MarketApplication | undefined>(undefined);
  const list = useRef<FlatList<MarketApplication>>(null); const generation = useRef(0); const loading = useRef(false);
  const current = useRef({ key: "", view: empty }); const restoreOffset = useRef<number | undefined>();
  const key = marketViewKey(category, search);
  useEffect(() => {
    let live = true;
    void readShellValue("market.filters").then(raw => { if (live && !edited.current && raw) { try { const saved = JSON.parse(raw); if (marketCategories.some(item => item.id === saved.category)) setCategory(saved.category); if (typeof saved.query === "string") { setQuery(saved.query); setSearch(saved.query); } } catch {} } if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => { const timer = setTimeout(() => setSearch(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  function apply(next: MarketView, target = key) { current.current = { key: target, view: next }; setView(next); rememberMarketView(target, next); }
  async function load(reset = false, manual = false) {
    if (loading.current || !reset && !current.current.view.nextCursor) return;
    const token = generation.current; loading.current = true; setBusy(true); setPulling(manual); setError(""); retryDetail.current = undefined;
    const before = current.current.view;
    try {
      const page = await fetchMarketPage(category, search, reset ? undefined : before.nextCursor);
      if (token !== generation.current) return;
      const known = new Set(before.applications.map(item => item.manifest.appId));
      apply({ applications: reset ? page.applications : [...before.applications, ...page.applications.filter(item => !known.has(item.manifest.appId))], nextCursor: page.nextCursor, at: Date.now(), offset: reset ? 0 : before.offset });
      if (reset) list.current?.scrollToOffset({ offset: 0, animated: false });
    } catch (e) { if (token === generation.current) setError(e instanceof Error ? e.message : "市场加载失败，请重试"); }
    finally { if (token === generation.current) { loading.current = false; setBusy(false); setPulling(false); } }
  }
  useEffect(() => {
    if (!focused || !ready) return;
    const token = ++generation.current; loading.current = false; setBusy(false); setPulling(false); setError("");
    writeShellValue("market.filters", JSON.stringify({ category, query: search }));
    if (current.current.key !== key) { current.current = { key, view: empty }; setView(empty); restoreOffset.current = undefined; list.current?.scrollToOffset({ offset: 0, animated: false }); }
    void readMarketView(key).then(cached => {
      if (token !== generation.current) return;
      if (cached) { if (!current.current.view.applications.length) restoreOffset.current = cached.offset; else restoreOffset.current = undefined; apply(cached); }
      if (!cached || Date.now() - cached.at > 60000) void load(true);
    });
    return () => { if (current.current.key === key) rememberMarketView(key, current.current.view); generation.current++; loading.current = false; };
  }, [key, focused, ready]);
  useEffect(() => subscribePackageValue("shell.market.changed", () => { if (focused) { generation.current++; loading.current = false; void load(true); } }), [focused, key]);
  useEffect(() => {
    const update = (entries: Awaited<ReturnType<typeof loadCatalog>>) => setInstalled(entries.filter(entry => !entry.trashedAt && !entry.purged).map(entry => entry.id));
    void loadCatalog().then(update); return subscribeCatalog(update);
  }, []);
  async function open(item: MarketApplication) {
    if (opening.current) return; opening.current = true; setOpeningId(item.manifest.appId);
    const token = generation.current;
    try { const fresh = await fetchPublicMarketApplication(item.manifest.appId); if (token === generation.current) onDetail(fresh); }
    catch (e) { if (token === generation.current) { retryDetail.current = item; setError(e instanceof Error ? e.message : "详情加载失败"); } }
    finally { opening.current = false; setOpeningId(undefined); }
  }
  return <Screen style={styles.screen}>
    <ScreenBar style={styles.header}>{onBack ? <BackChip onPress={onBack} /> : null}<Text accessibilityRole="header" style={[styles.title, { flex: 1 }]}>应用市场</Text><Pressy accessibilityRole="button" accessibilityLabel="创作新应用" onPress={onCreate} style={styles.create}><Icon name="plus" size={20} color={colors.onAccent} /></Pressy></ScreenBar>
    <FlatList ref={list} data={search || category ? view.applications : view.applications.slice(1)} keyExtractor={item => item.manifest.appId} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" removeClippedSubviews={false}
      onContentSizeChange={(_, height) => { if (restoreOffset.current !== undefined && height > restoreOffset.current) { list.current?.scrollToOffset({ offset: restoreOffset.current, animated: false }); restoreOffset.current = undefined; } }}
      onScroll={event => { if (restoreOffset.current === undefined && current.current.key === key) { const next = { ...current.current.view, offset: Math.max(0, event.nativeEvent.contentOffset.y) }; current.current.view = next; rememberMarketView(key, next, false); } }} scrollEventThrottle={200}
      refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void load(true, true)} tintColor={colors.accent} />}
      onEndReached={() => { if (!error) void load(); }} onEndReachedThreshold={0.4}
      ListHeaderComponent={<View style={styles.discovery}>
        <View style={[styles.searchBox, searchFocused && { borderColor: colors.accentText }]}><Search size={17} color={colors.ink3} /><TextInput accessibilityLabel="搜索应用或用途" placeholder="搜索应用或用途" placeholderTextColor={colors.ink3} value={query} maxLength={80} onChangeText={value => { edited.current = true; setQuery(value); }} selectionColor={colors.accentText} onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} style={styles.search} />{query ? <Pressy accessibilityLabel="清空搜索" onPress={() => { edited.current = true; setQuery(""); }} style={styles.clear}><Icon name="close" size={16} color={colors.ink3} /></Pressy> : null}</View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{marketCategories.map(item => <Pressy key={item.id} accessibilityRole="button" accessibilityState={{ selected: category === item.id }} onPress={() => { edited.current = true; setCategory(item.id); }} style={[styles.chip, category === item.id && { backgroundColor: colors.accentTint }]}><Text style={{ color: category === item.id ? colors.accentText : colors.ink3 }}>{item.label}</Text></Pressy>)}</ScrollView>
        {!search && !category && view.applications[0] ? <FeaturedApplication item={view.applications[0]} busy={openingId === view.applications[0].manifest.appId} onPress={() => void open(view.applications[0])} /> : null}<View style={styles.sectionHead}><Text style={styles.sectionTitle}>{search ? "搜索结果" : category ? marketCategories.find(item => item.id === category)?.label : "全部应用"}</Text><Text style={styles.caption}>{view.applications.length ? `${view.applications.length}${view.nextCursor ? "+" : ""} 个应用` : ""}</Text></View>
        {error ? <Pressy onPress={() => { const failed = retryDetail.current; if (failed) void open(failed); else void load(true); }}><Text style={styles.error}>{error} · 点此重试</Text></Pressy> : null}
      </View>}
      renderItem={({ item }) => { const app = item.manifest; const Avatar = marketDefinition(item)?.avatar; return <Pressy accessibilityRole="button" accessibilityLabel={`查看${item.title || app.title}`} onPress={() => void open(item)}><View style={styles.row}><View style={styles.rowHead}><View style={[styles.mark, { backgroundColor: `${app.accent}18` }]}>{Avatar ? <Avatar size={44} /> : <Text style={{ fontSize: 20, color: app.accent }}>{app.mark}</Text>}</View><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={styles.name} numberOfLines={2}>{item.title || app.title}</Text><Text style={styles.summary} numberOfLines={2}>{item.summary || app.summary}</Text></View><Text style={styles.badge}>{openingId === app.appId ? "加载中…" : installed.includes(app.appId) ? "已安装" : "查看"}</Text></View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Pressy disabled={!item.authorId} accessibilityLabel={`查看${item.authorName}的主页`} onPress={event => { event.stopPropagation(); if (item.authorId) onAuthor({ id: item.authorId, name: item.authorName, avatarUrl: item.authorAvatarUrl ?? null, official: item.authorOfficial }); }} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, minHeight: 36, flexShrink: 1 }}>{item.authorAvatarUrl ? <Image source={{ uri: item.authorAvatarUrl }} style={{ width: 18, height: 18, borderRadius: 9 }} /> : null}<Text style={[styles.caption, { flexShrink: 1 }]} numberOfLines={1}>{item.authorName || "社区创作者"}</Text>{item.authorOfficial ? <Text style={styles.official}>官方</Text> : null}</Pressy><Text style={styles.caption}>{marketCategories.find(category => category.id === (item.category || "other"))?.label}</Text></View>
      </View></Pressy>; }}
      ListEmptyComponent={view.applications.length || error ? null : busy ? <ActivityIndicator style={{ margin: 16 }} color={colors.accent} /> : <Text style={styles.empty}>{search || category ? "没有找到匹配的应用，换个分类或关键词试试" : "还没有公开的应用，来发布第一份作品吧"}</Text>}
      ListFooterComponent={busy && view.applications.length ? <ActivityIndicator style={{ margin: 16 }} color={colors.accent} /> : view.nextCursor ? <Pressy onPress={() => void load()}><Text style={styles.empty}>加载更多</Text></Pressy> : view.applications.length ? <Text style={styles.empty}>已浏览全部应用</Text> : null}
    />
  </Screen>;
}
function FeaturedApplication({ item, busy, onPress }: { item: MarketApplication; busy: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const app = item.manifest;
  const Avatar = marketDefinition(item)?.avatar;
  return <Animated.View entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}>
    <Pressy disabled={busy} onPress={onPress} accessibilityLabel={`查看最新上架应用 ${item.title || app.title}`} style={styles.featured}>
      <View style={styles.featuredTop}><Text style={styles.featuredLabel}>{busy ? "正在打开…" : "最新上架"}</Text><ArrowUpRight size={18} color={colors.accentText} /></View>
      <View style={styles.rowHead}>
        <View style={[styles.mark, { backgroundColor: `${app.accent}18` }]}>{Avatar ? <Avatar size={44} /> : <Text style={{ color: app.accent, fontSize: 20 }}>{app.mark}</Text>}</View>
        <View style={styles.featuredCopy}><Text style={styles.featuredName} numberOfLines={2}>{item.title || app.title}</Text><Text style={styles.summary} numberOfLines={2}>{item.summary || app.summary}</Text><Text numberOfLines={1} style={[styles.caption, { flexShrink: 1 }]} numberOfLines={1}>{item.authorName || "社区创作者"}</Text></View>
        {item.screenshots?.[0] ? <FastImage accessibilityLabel={`${item.title || app.title}的真实应用截图`} source={{ uri: item.screenshots[0] }} style={styles.featuredImage} resizeMode={FastImage.resizeMode.cover} /> : null}
      </View>
    </Pressy>
  </Animated.View>;
}
const styles = themedStyleSheet(t => ({
  screen: { flex: 1, backgroundColor: t.canvas },
  header: { paddingHorizontal: 16, paddingVertical: 4, gap: 8, alignItems: "center", flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: t.line },
  title: { fontSize: 21, letterSpacing: -0.5, fontWeight: "800", color: t.ink1 },
  caption: { fontSize: 12, lineHeight: 18, color: t.ink3 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  discovery: { gap: 12, paddingTop: 12, paddingBottom: 4 },
  create: { width: 44, height: 44, borderRadius: t.radius.sm, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", paddingLeft: 12, borderRadius: t.radius.sm, backgroundColor: t.inset, borderWidth: 0.5, borderColor: t.lineStrong, gap: 8 },
  search: { flex: 1, minWidth: 0, minHeight: 44, color: t.ink1, paddingVertical: 8, fontSize: 14 },
  clear: { width: 44, alignItems: "center" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 },
  sectionTitle: { color: t.ink1, fontSize: 14, fontWeight: "700" },
  featured: { padding: 14, backgroundColor: t.accentTint, borderWidth: 0.5, borderColor: t.accentSoft, borderRadius: t.radius.md, gap: 12 },
  featuredTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  featuredLabel: { fontSize: 11, fontWeight: "600", color: t.accentText },
  featuredName: { fontSize: 21, lineHeight: 28, color: t.ink1, fontWeight: "800", letterSpacing: -0.5 },
  featuredCopy: { flex: 1, minWidth: 0, gap: 4 },
  featuredImage: { width: 64, height: 88, borderRadius: t.radius.sm, backgroundColor: t.inset },
  chip: { minHeight: 44, justifyContent: "center", borderRadius: t.radius.sm, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: t.surface },
  row: { gap: 2, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: t.line },
  rowHead: { flexDirection: "row", gap: 12, alignItems: "center" },
  mark: { width: 44, height: 44, borderRadius: t.radius.sm, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  name: { color: t.ink1, fontSize: 15, fontWeight: "600" },
  summary: { color: t.ink2, fontSize: 13, lineHeight: 19 },
  official: { color: t.accentText, backgroundColor: t.accentTint, fontSize: 10, fontWeight: "600", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, overflow: "hidden" },
  badge: { flexShrink: 0, color: t.accentText, fontSize: 11, fontWeight: "600", backgroundColor: t.accentTint, paddingHorizontal: 8, paddingVertical: 4, borderRadius: t.radius.xs },
  error: { color: t.redText, fontSize: 13, lineHeight: 20 },
  empty: { color: t.ink3, textAlign: "center", paddingVertical: 20 },
}));
