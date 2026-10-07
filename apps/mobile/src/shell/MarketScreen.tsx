import { ApplicationIcon } from "./ApplicationIcon";
import { TextInput } from "../../../../packages/ui/primitives/Typography";
import { UserAvatar } from "./UserAvatar";
import { EmptyState } from "./EmptyState";
import { ActivityIndicator } from "react-native";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, ScrollView, View } from "react-native";
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { PixelText as Text } from "./feed/PixelText";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
  runOnJS,
  runOnUI,
  useEvent,
} from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import { Screen, ScreenBar } from "../../../../packages/ui/edge";
import { ThemeContext, createThemedStyles, useTheme } from "../../../../packages/ui/theme";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { loadCatalog, subscribeCatalog } from "./catalog";
import { readShellValue, writeShellValue } from "./shellStorage";
import {
  fetchMarketPage,
  readMarketView,
  cachedMarketView,
  rememberMarketView,
  marketViewKey,
  marketCategories,
  marketDiscoveryCategories,
  type MarketView,
  type MarketApplication,
} from "./market";
import { CompactTabs } from "./CompactTabs";
import { MyApplicationsScreen } from "./MyApplicationsScreen";
import { SymbolIcon } from "./feed/PixelKit";

import { usePullToRefresh } from "./feed/pullToRefresh";
import { PullRefreshSurface } from "./feed/PullRefreshSurface";
import { useProfileDrawer } from "./ProfileDrawer";
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);
const empty: MarketView = { applications: [], at: 0, offset: 0 };
type MarketProps = {
  onAuthor: (author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    official?: boolean;
  }) => void;
  onDetail: (item: MarketApplication) => void;
  onCreate: () => void;
  onBack?: () => void;
  onOpen: (id: string) => void;
};
export function MarketScreen(props: MarketProps) {
  const theme = useTheme();
  return (
    <ThemeContext.Provider value={theme}>
      <MarketContent {...props} />
    </ThemeContext.Provider>
  );
}
function MarketContent(props: MarketProps) {
  const styles = useStyles();

  const { colors } = useTheme();
  const [discoveryQuery, setDiscoveryQuery] = useState("");
  const [installedQuery, setInstalledQuery] = useState("");
  const queryEdited = useRef(false);
  const [section, setSection] = useState<"discover" | "installed">("discover");
  const { gesture, marketActive, marketPosition } = useProfileDrawer();
  const pager = useRef<PagerView>(null);
  useFocusEffect(
    useCallback(() => {
      runOnUI(() => {
        "worklet";
        marketActive.value = true;
      })();
      return () => {
        runOnUI(() => {
          "worklet";
          marketActive.value = false;
        })();
      };
    }, [marketActive])
  );
  const native = useMemo(
    () => Gesture.Native().requireExternalGestureToFail(gesture),
    [gesture]
  );
  const onPageScroll = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      "worklet";
      marketPosition.value = event.position + event.offset;
    },
    ["onPageScroll"]
  );
  const onPageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    (event) => {
      "worklet";
      runOnJS(setSection)(event.position === 0 ? "discover" : "installed");
    },
    ["onPageSelected"]
  );
  return (
    <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenBar
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: 6,
          backgroundColor: colors.canvas,
        }}
      >
        {props.onBack ? (
          <Pressy
            accessibilityLabel="返回"
            onPress={props.onBack}
            style={{ width: 44 }}
          >
            <SymbolIcon name="back" size={20} color={colors.ink1} />
          </Pressy>
        ) : null}
        <Text
          accessibilityRole="header"
          style={{ fontSize: 18, color: colors.ink1 }}
        >
          应用市场
        </Text>
        <View style={[styles.searchBox, { flex: 1, minWidth: 0 }]}>
          <SymbolIcon name="search" size={15} color={colors.ink3} />
          <TextInput
            accessibilityLabel={
              section === "discover" ? "搜索应用或用途" : "搜索已安装应用"
            }
            placeholder={section === "discover" ? "搜索应用" : "搜索已安装"}
            placeholderTextColor={colors.ink3}
            maxLength={80}
            value={section === "discover" ? discoveryQuery : installedQuery}
            onChangeText={(value) => {
              if (section === "discover") {
                queryEdited.current = true;
                setDiscoveryQuery(value);
              } else setInstalledQuery(value);
            }}
            style={[styles.search, { fontSize: 13 }]}
          />
          {(section === "discover" ? discoveryQuery : installedQuery) ? (
            <Pressy
              accessibilityLabel="清空搜索"
              onPress={() => {
                if (section === "discover") {
                  queryEdited.current = true;
                  setDiscoveryQuery("");
                } else setInstalledQuery("");
              }}
              style={styles.clear}
            >
              <SymbolIcon name="close" size={14} color={colors.ink3} />
            </Pressy>
          ) : null}
        </View>
      </ScreenBar>
      <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 6 }}>
        <CompactTabs
          tone="mint"
          value={section}
          position={marketPosition}
          options={[
            { id: "discover", label: "发现作品", icon: "spark" },
            { id: "installed", label: "我安装的", icon: "box" },
          ]}
          onChange={(value) =>
            pager.current?.setPage(value === "discover" ? 0 : 1)
          }
        />
      </View>
      <GestureDetector gesture={native}>
        <AnimatedPagerView
          ref={pager}
          style={{ flex: 1 }}
          offscreenPageLimit={1}
          overScrollMode="never"
          onPageScroll={onPageScroll}
          onPageSelected={onPageSelected}
        >
          <View key="discover" collapsable={false} style={{ flex: 1 }}>
            <MarketDiscovery
              {...props}
              active={section === "discover"}
              query={discoveryQuery}
              onQueryChange={setDiscoveryQuery}
              queryEdited={queryEdited}
            />
          </View>
          <View key="installed" collapsable={false} style={{ flex: 1 }}>
            <MyApplicationsScreen
              scope="installed"
              searchQuery={installedQuery}
              embedded
              active={section === "installed"}
              drawerGesture={gesture}
              onCreate={props.onCreate}
              onOpen={props.onOpen}
              onDetail={props.onDetail}
            />
          </View>
        </AnimatedPagerView>
      </GestureDetector>
    </Screen>
  );
}
function MarketDiscovery({
  onDetail,
  onAuthor,
  active,
  query,
  onQueryChange,
  queryEdited,
}: MarketProps & {
  active: boolean;
  query: string;
  onQueryChange: (query: string) => void;
  queryEdited: { current: boolean };
}) {
  const styles = useStyles();

  const { gesture: drawerGesture } = useProfileDrawer();
  const scrollY = useSharedValue(0);
  const lastSave = useSharedValue(0);
  const refreshPull = usePullToRefresh({
    scrollY,
    onRefresh: () => load(true, true),
  });
  const rememberOffset = (offset: number) => {
    if (restoreOffset.current === undefined && current.current.key === key) {
      const next = { ...current.current.view, offset };
      current.current.view = next;
      rememberMarketView(key, next, false);
    }
  };
  const trackScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = Math.max(0, event.contentOffset.y);
    const now = Date.now();
    if (now - lastSave.value >= 200) {
      lastSave.value = now;
      runOnJS(rememberOffset)(scrollY.value);
    }
  });
  const { colors } = useTheme();
  const focused = useIsFocused() && active;
  const [view, setView] = useState<MarketView>(() => cachedMarketView(marketViewKey("", "")) ?? empty);
  const [installed, setInstalled] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const edited = useRef(false);
  const list = useRef<FlatList<MarketApplication>>(null);
  const generation = useRef(0);
  const loading = useRef(false);
  const current = useRef({ key: "", view: empty });
  const restoreOffset = useRef<number | undefined>(undefined);
  const key = marketViewKey(category, search);
  useEffect(() => {
    let live = true;
    void readShellValue("market.filters").then((raw) => {
      if (live && !edited.current && raw) {
        try {
          const saved = JSON.parse(raw);
          if (
            marketDiscoveryCategories.some((item) => item.id === saved.category)
          )
            setCategory(saved.category);
          if (!queryEdited.current && typeof saved.query === "string") {
            onQueryChange(saved.query);
            setSearch(saved.query);
          }
        } catch {}
      }
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  function apply(next: MarketView, target = key) {
    current.current = { key: target, view: next };
    setView(next);
    rememberMarketView(target, next);
  }
  async function load(reset = false, manual = false) {
    if (loading.current || (!reset && !current.current.view.nextCursor))
      return false;
    const token = generation.current;
    loading.current = true;
    setBusy(true);
    setPulling(manual);
    setError("");
    const before = current.current.view;
    try {
      const page = await fetchMarketPage(
        category,
        search,
        reset ? undefined : before.nextCursor
      );
      if (token !== generation.current) return;
      const known = new Set(
        before.applications.map((item) => item.manifest.appId)
      );
      const next: MarketView = {
        applications: reset
          ? page.applications
          : [
              ...before.applications,
              ...page.applications.filter(
                (item) => !known.has(item.manifest.appId)
              ),
            ],
        nextCursor: page.nextCursor,
        at: Date.now(),
        offset: reset && manual ? 0 : before.offset,
      };
      apply(next);
      if (reset && manual)
        list.current?.scrollToOffset({ offset: 0, animated: false });
      return true;
    } catch (e) {
      if (token === generation.current)
        setError(e instanceof Error ? e.message : "市场加载失败，请重试");
      return false;
    } finally {
      if (token === generation.current) {
        loading.current = false;
        setBusy(false);
        setPulling(false);
      }
    }
  }
  useEffect(() => {
    if (!focused || !ready) return;
    const token = ++generation.current;
    loading.current = false;
    setBusy(false);
    setPulling(false);
    setError("");
    writeShellValue(
      "market.filters",
      JSON.stringify({ category, query: search })
    );
    if (current.current.key !== key) {
      current.current = { key, view: empty };
      setView(empty);
      restoreOffset.current = undefined;
      list.current?.scrollToOffset({ offset: 0, animated: false });
    }
    void readMarketView(key).then((cached) => {
      if (token !== generation.current) return;
      if (cached) {
        if (!current.current.view.applications.length)
          restoreOffset.current = cached.offset;
        else restoreOffset.current = undefined;
        apply(cached);
      }
      if (!cached || Date.now() - cached.at > 60000) void load(true);
    });
    return () => {
      if (current.current.key === key)
        rememberMarketView(key, current.current.view);
      generation.current++;
      loading.current = false;
    };
  }, [key, focused, ready]);
  useEffect(
    () =>
      subscribePackageValue("shell.market.changed", () => {
        if (focused) {
          generation.current++;
          loading.current = false;
          void load(true);
        }
      }),
    [focused, key]
  );
  useEffect(() => {
    const update = (entries: Awaited<ReturnType<typeof loadCatalog>>) =>
      setInstalled(
        entries
          .filter((entry) => !entry.trashedAt && !entry.purged)
          .map((entry) => entry.id)
      );
    void loadCatalog().then(update);
    return subscribeCatalog(update);
  }, []);
  const open = useCallback((item: MarketApplication) => onDetail(item), [onDetail]);
  const installedIds = useMemo(() => new Set(installed), [installed]);
  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <View style={styles.discovery}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingRight: 16 }}
        >
          {marketDiscoveryCategories.map((item) => (
            <Pressy
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: category === item.id }}
              onPress={() => {
                edited.current = true;
                setCategory(item.id);
              }}
              style={[
                styles.chip,
                category === item.id && {
                  backgroundColor:
                    item.id === "official" ? colors.orchid : colors.accent,
                },
              ]}
            >
              <Text
                style={{
                  color: category === item.id ? colors.onAccent : colors.ink2,
                }}
              >
                {item.label}
              </Text>
            </Pressy>
          ))}
        </ScrollView>
      </View>
      <PullRefreshSurface refresh={refreshPull} drawerGesture={drawerGesture}>
        <Animated.FlatList
          ref={list}
          data={view.applications}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          keyExtractor={(item) => item.manifest.appId}
          contentContainerStyle={[styles.content, !view.applications.length && { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          onContentSizeChange={(_, height) => {
            if (
              restoreOffset.current !== undefined &&
              height > restoreOffset.current
            ) {
              list.current?.scrollToOffset({
                offset: restoreOffset.current,
                animated: false,
              });
              restoreOffset.current = undefined;
            }
          }}
          onScroll={trackScroll}
          scrollEventThrottle={16}
          bounces={false}
          overScrollMode="never"
          scrollEnabled={
            refreshPull.phase !== "refreshing" && refreshPull.phase !== "done"
          }
          onEndReached={() => {
            if (!error) void load();
          }}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>
                  {search
                    ? "搜索结果"
                    : category
                    ? marketDiscoveryCategories.find(
                        (item) => item.id === category
                      )?.label
                    : "最新发布"}
                </Text>
                <Text style={styles.caption}>
                  {view.applications.length
                    ? `${view.applications.length}${
                        view.nextCursor ? "+" : ""
                      } 个应用`
                    : ""}
                </Text>
              </View>
              {error ? (
                <Pressy
                  onPress={() => {
                    void load(true);
                  }}
                >
                  <Text style={styles.error}>{error} · 点此重试</Text>
                </Pressy>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <MarketApplicationRow
              item={item}
              installed={installedIds.has(item.manifest.appId)}
              onOpen={open}
              onAuthor={onAuthor}
            />
          )}
          ListEmptyComponent={
            view.applications.length || error ? null : !view.at ? (
              <View accessibilityLabel="正在加载应用" style={{ gap: 1 }}>
                {[0, 1, 2, 3, 4].map((id) => (
                  <View
                    key={id}
                    style={[styles.row, { flexDirection: "row", gap: 12 }]}
                  >
                    <View
                      style={[styles.mark, { backgroundColor: colors.inset }]}
                    />
                    <View style={{ flex: 1, gap: 9 }}>
                      <View
                        style={{
                          width: "55%",
                          height: 16,
                          backgroundColor: colors.inset,
                          borderRadius: 4,
                        }}
                      />
                      <View
                        style={{
                          height: 12,
                          backgroundColor: colors.inset,
                          borderRadius: 4,
                        }}
                      />
                      <View
                        style={{
                          width: "35%",
                          height: 10,
                          backgroundColor: colors.inset,
                          borderRadius: 4,
                        }}
                      />
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <EmptyState><Text style={styles.empty}>
                {search || category
                  ? "没有找到匹配的应用，换个分类或关键词试试"
                  : "还没有公开的应用，来发布第一份作品吧"}
              </Text></EmptyState>
            )
          }
          ListFooterComponent={
            busy && view.applications.length && !pulling ? (
              <ActivityIndicator style={{ margin: 16 }} color={colors.accent} />
            ) : view.nextCursor ? (
              <Pressy onPress={() => void load()}>
                <Text style={styles.empty}>加载更多</Text>
              </Pressy>
            ) : view.applications.length ? (
              <Text style={styles.empty}>已浏览全部应用</Text>
            ) : null
          }
        />
      </PullRefreshSurface>
    </View>
  );
}
const MarketApplicationRow = memo(function MarketApplicationRow({
  item,
  installed,
  onOpen,
  onAuthor,
}: {
  item: MarketApplication;
  installed: boolean;
  onOpen: (item: MarketApplication) => void;
  onAuthor: MarketProps["onAuthor"];
}) {
  const styles = useStyles();

  const { colors } = useTheme();
  const app = item.manifest;
  const bytes = app.bundle.bytes + app.assets.reduce((total, asset) => total + asset.bytes, 0);
  const downloads = item.downloadCount ?? 0;
  const downloadLabel = downloads >= 10000 ? `${(downloads / 10000).toFixed(1)}万` : downloads >= 1000 ? `${(downloads / 1000).toFixed(1)}k` : String(downloads);
  const sizeLabel = bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  const category = marketCategories.find(
    (category) => category.id === (item.category || "other")
  )?.label;
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={`查看${item.title || app.appName}${
        installed ? "，已安装" : ""
      }`}
      onPress={() => void onOpen(item)}
      scale={1}
      style={styles.row}
    >
      <View style={styles.mark}>
        <ApplicationIcon application={item} size={72} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[styles.name, { flexShrink: 1 }]} numberOfLines={1}>
            {item.title || app.appName}
          </Text>
          {item.authorOfficial ? (
            <Text style={styles.official}>官方</Text>
          ) : null}
        </View>
        <Text style={styles.summary} numberOfLines={1}>
          {item.summary || app.description || "查看应用详情"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 28, gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Pressy
            disabled={!item.authorId}
            hitSlop={{ top: 8, bottom: 8 }}
            accessibilityRole="button"
            accessibilityLabel={`查看${item.authorName || "创作者"}的主页`}
            onPress={(event) => {
              event.stopPropagation();
              if (item.authorId)
                onAuthor({
                  id: item.authorId,
                  name: item.authorName,
                  avatarUrl: item.authorAvatarUrl ?? null,
                  official: item.authorOfficial,
                });
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              flexShrink: 1,
              minHeight: 28,
              minWidth: 0,
            }}
          >
            <UserAvatar uri={item.authorAvatarUrl} authorId={item.authorId} size={16} />
            <Text numberOfLines={1} style={[styles.caption, { flexShrink: 1 }]}>
              {item.authorName || "社区创作者"}
            </Text>
          </Pressy>
          <Text style={styles.category}>{category}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", flexShrink: 0, gap: 5 }}>
          <Text style={styles.category} accessibilityLabel={`${downloads} 次下载`}>{downloadLabel} 下载</Text>
          <Text style={styles.category} accessibilityLabel={`应用大小 ${sizeLabel}`}>{sizeLabel}</Text>
          </View>
        </View>
      </View>
      <View
        style={[
          styles.openMark,
          { backgroundColor: installed ? colors.greenTint : colors.cyanTint },
        ]}
      >
        <SymbolIcon
          name={installed ? "check" : "arrow"}
          size={16}
          color={installed ? colors.greenText : colors.cyanText}
        />
        <Text
          style={{
            fontSize: 10,
            color: installed ? colors.greenText : colors.cyanText,
          }}
        >
          {installed ? "已安装" : "查看"}
        </Text>
      </View>
    </Pressy>
  );
});
const useStyles = createThemedStyles((base) => {
  const t = base;
  return {
    screen: { flex: 1, backgroundColor: t.canvas },
    caption: { fontSize: 11, lineHeight: 16, color: t.ink3 },
    content: { paddingHorizontal: 16, paddingBottom: 16 },
    discovery: {
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 8,
    },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: 12,
      borderRadius: t.radius.sm,
      backgroundColor: t.surface,
      borderWidth: 0.5,
      borderColor: t.lineStrong,
      gap: 8,
    },
    search: {
      flex: 1,
      minWidth: 0,
      minHeight: 44,
      color: t.ink1,
      paddingVertical: 8,
      fontSize: 14,
    },
    clear: { width: 44, alignItems: "center" },
    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 8,
    },
    sectionTitle: { color: t.ink1, fontSize: 14, fontWeight: "700" },
    chip: {
      minHeight: 44,
      justifyContent: "center",
      borderRadius: t.radius.md,
      paddingHorizontal: 14,
      paddingVertical: 6,
      backgroundColor: t.surface,
    },
    row: {
      minHeight: 88,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: t.line,
    },
    mark: {
      width: 72,
      height: 72,
      borderRadius: t.radius.md,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    name: { color: t.ink1, fontSize: 16, lineHeight: 21, fontWeight: "600" },
    summary: { color: t.ink2, fontSize: 12, lineHeight: 17 },
    official: {
      color: t.orchidText,
      backgroundColor: t.orchidTint,
      fontSize: 10,
      fontWeight: "600",
      borderRadius: t.radius.sm,
      paddingHorizontal: 5,
      paddingVertical: 2,
      overflow: "hidden",
    },
    category: { color: t.ink3, fontSize: 10, lineHeight: 14 },
    openMark: {
      width: 42,
      minHeight: 42,
      borderRadius: t.radius.md,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    error: { color: t.redText, fontSize: 13, lineHeight: 20 },
    empty: { color: t.ink3, textAlign: "center", paddingVertical: 20 },
  };
});
