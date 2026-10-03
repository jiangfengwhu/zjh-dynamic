import { PixelText as Text } from "./PixelText";
import { FeedCategoryTabs } from "./FeedCategoryTabs";
import PagerView from "react-native-pager-view";
import { useFeedPager, type FeedCategory } from "./useFeedPager";
import { PixelText } from "./PixelText";
import { FeedPresentationContext } from "../../../../../packages/ui/feed/kit/FeedPresentation";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  cancelAnimation,
  runOnUI,
} from "react-native-reanimated";
import { bundles } from "../../../../../packages/features/src/registry";
import {
  KIND_LABEL,
  peekFeedTemplate,
  readFeedPosts,
  subscribeFeedPosts,
  subscribeFeedTemplates,
  type FeedFriend,
  type FeedKind,
  type FeedPost,
  type FeedSlot,
} from "../../../../../packages/ui/feed";
import { Pressy } from "../../../../../packages/ui/chrome";
const bootstrap = require("../../../../../tools/applications/bootstrap.json");
import {
  ThemeContext,
  themedStyleSheet,
} from "../../../../../packages/ui/theme";
import { pixelTheme, usePixelTheme } from "./pixelTheme";
import { PixelAvatar, PixelIcon } from "./PixelKit";
import NativePluginHost from "../../NativePluginHost";
import { useFeedChrome, SHELL_BOTTOM_PADDING } from "./FeedChrome";
import { subscribeFeedSummaryBusy } from "./summary";
import { useAccount } from "../account";
import { CardSlot } from "./CardSlot";
import { PullIndicator } from "./PullIndicator";
import { usePullToRefresh } from "./pullToRefresh";
import { subscribeLikes, toggleLike } from "./likes";
import { markSeen, subscribeSeen, type SeenMap } from "./seen";
import {
  useUserPosts,
  refreshUserPosts,
  loadMoreUserPosts,
  type UserPost,
} from "./userPosts";
import { UserPostCard } from "./UserPostCard";
import Toast from "react-native-toast-message";
import { AppImage } from "../../../../../packages/ui/media/AppImage";

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

type FeedProps = {
  installedIds: string[];
  onOpen: (id: string) => Promise<boolean>;
  /** 对某位朋友说一句：带着 TA 的名字去工坊。 */
  onReply: (id: string) => void;
  /** 找新朋友：去应用市场发现应用。 */
  onNew: () => void;
  onCompose: () => void;
  onPost: (post: UserPost) => void;
  onProfile: () => void;
  onApplication: (appId: string) => Promise<void>;
  onAuthor: (author: UserPost["author"]) => void;
};

export const FeedScreen = memo(function FeedScreen({
  onOpen,
  onReply,
  onCompose,
  onPost,
  onProfile,
  onApplication,
  onAuthor,

  installedIds,
}: FeedProps) {
  const { user } = useAccount();
  const themeContext = usePixelTheme();
  const { colors, mode } = themeContext;
  const insets = useSafeAreaInsets();
  const { hidden: chromeHidden, tabHeight } = useFeedChrome();
  // Native window owns transparent system bars. Pages only request their colors.
  useFocusEffect(
    useCallback(() => {
      void NativePluginHost.call(
        "shell",
        "systemBars",
        JSON.stringify({
          statusBar: colors.canvas,
          navigationBar: colors.canvas,
          window: colors.canvas,
          light: mode === "light",
        })
      ).catch(() => {});
    }, [colors.canvas, mode])
  );
  const userTimeline = useUserPosts();
  const [loadingMore, setLoadingMore] = useState(false);
  const [timelineError, setTimelineError] = useState("");
  const [allPosts, setPosts] = useState<FeedPost[]>(() => readFeedPosts());
  const posts = useMemo(
    () =>
      allPosts.filter(
        (post) =>
          installedIds.includes(post.appId) &&
          (post.appId !== bootstrap.defaultApplication ||
            !post.payload.workshopPost ||
            Boolean(user && post.payload.ownerId === user.id))
      ),
    [allPosts, installedIds, user?.id]
  );
  const [seen, setSeen] = useState<SeenMap>({});
  const [likes, setLikes] = useState<string[]>([]);
  const [kind, setKind] = useState<FeedSlot | "user" | null>(null);
  const [cardsReady, setCardsReady] = useState(0);
  const [summarizing, setSummarizing] = useState(false);
  const [timeTick, tickTime] = useState(0);
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => tickTime((value) => value + 1), 60000);
      return () => clearInterval(timer);
    }, [])
  );

  const scrollY = useSharedValue(0);
  const selectedKey = kind ?? "all";
  const activeCategory = useSharedValue(selectedKey);
  const scrollMemory = useSharedValue<
    Record<string, { offset: number; viewport: number; content: number }>
  >({});
  const headerHeight = useSharedValue(144);
  const hiddenHeader = useSharedValue(0);
  const dragging = useSharedValue(false);
  const momentum = useSharedValue(false);
  const layoutSize = useSharedValue({ viewport: 0, content: 0 });
  const [headerSize, setHeaderSize] = useState(144);
  const [viewportSize, setViewportSize] = useState(0);
  const onScroll = useAnimatedScrollHandler(
    {
      onBeginDrag: (event) => {
        if (activeCategory.value !== selectedKey) return;
        cancelAnimation(hiddenHeader);
        dragging.value = true;
        scrollY.value = Math.max(0, event.contentOffset.y);
        layoutSize.value = {
          viewport: event.layoutMeasurement.height,
          content: event.contentSize.height,
        };
      },
      onScroll: (event) => {
        if (activeCategory.value !== selectedKey) return;
        const next = Math.max(0, event.contentOffset.y);
        const size = {
          viewport: event.layoutMeasurement.height,
          content: event.contentSize.height,
        };
        layoutSize.value = size;
        // Only vertical interaction changes shared chrome visibility.
        // Category attachment and layout events preserve the current state.
        if (dragging.value || momentum.value) {
          const delta = next - scrollY.value;
          hiddenHeader.value =
            next === 0 && delta < 0
              ? 0
              : Math.max(
                  0,
                  Math.min(headerHeight.value, hiddenHeader.value + delta)
                );
          chromeHidden.value =
            headerHeight.value > 0
              ? hiddenHeader.value / headerHeight.value
              : 0;
        }
        scrollY.value = next;
        scrollMemory.value = {
          ...scrollMemory.value,
          [selectedKey]: {
            offset: next,
            viewport: size.viewport,
            content: size.content,
          },
        };
      },
      onMomentumBegin: () => {
        if (activeCategory.value === selectedKey) momentum.value = true;
      },
      onMomentumEnd: () => {
        if (activeCategory.value === selectedKey) momentum.value = false;
      },
      onEndDrag: () => {
        if (activeCategory.value === selectedKey) dragging.value = false;
      },
    },
    [selectedKey]
  );
  const headerMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: -hiddenHeader.value }],
  }));
  const bottomSpace = useAnimatedStyle(() => ({
    paddingBottom: tabHeight.value + 68,
  }));
  const composePosition = useAnimatedStyle(() => ({
    bottom: Math.max(SHELL_BOTTOM_PADDING, insets.bottom, tabHeight.value) + 12,
    transform: [{ translateY: chromeHidden.value * (tabHeight.value + 76) }],
    opacity: 1 - chromeHidden.value,
  }));
  useFocusEffect(
    useCallback(() => {
      runOnUI((key: string) => {
        "worklet";
        cancelAnimation(hiddenHeader);
        activeCategory.value = key;
        const saved = scrollMemory.value[key];
        scrollY.value = saved?.offset ?? 0;
        layoutSize.value = {
          viewport: saved?.viewport ?? 0,
          content: saved?.content ?? 0,
        };
        dragging.value = false;
        momentum.value = false;
      })(selectedKey);
    }, [
      selectedKey,
      activeCategory,
      scrollMemory,
      scrollY,
      hiddenHeader,
      headerHeight,
      chromeHidden,
      layoutSize,
      dragging,
      momentum,
    ])
  );

  useEffect(() => subscribeFeedPosts(setPosts), []);
  useEffect(() => subscribeSeen(setSeen), []);
  useEffect(() => subscribeLikes(setLikes), []);
  useEffect(
    () => subscribeFeedTemplates(() => setCardsReady((value) => value + 1)),
    []
  );
  useEffect(() => subscribeFeedSummaryBusy(setSummarizing), []);
  useEffect(() => {
    void refreshUserPosts().then(
      () => setTimelineError(""),
      () => setTimelineError("用户动态暂时未能同步，下拉可重试")
    );
  }, []);

  const { pull, phase, gesture } = usePullToRefresh({
    scrollY,
    onRefresh: async () => {
      setPosts(readFeedPosts());
      try {
        await refreshUserPosts();
        setTimelineError("");
      } catch (error) {
        setTimelineError("用户动态暂时未能同步，下拉可重试");
        Toast.show({
          type: "error",
          text1: "刷新未完成",
          text2: error instanceof Error ? error.message : "请稍后重试",
        });
        return false;
      }
    },
  });
  const refreshSpace = useAnimatedStyle(() => ({ height: pull.value }));

  const friends = useMemo(() => {
    const map = new Map<string, FeedFriend>();
    for (const bundle of bundles.filter((item) =>
      installedIds.includes(item.id)
    )) {
      map.set(bundle.id, {
        id: bundle.id,
        name: bundle.title,
        mark: bundle.mark,
        accent: bundle.accent,
        Avatar: bundle.avatar,
      });
    }
    return map;
  }, [installedIds, cardsReady]);

  /** 每位朋友最近一条动态的时间，用来判断有没有没看过的。 */
  const latest = useMemo(() => {
    const result: Record<string, number> = {};
    for (const post of posts)
      result[post.appId] = Math.max(result[post.appId] ?? 0, post.createdAt);
    return result;
  }, [posts]);

  const liked = useMemo(() => new Set(likes), [likes]);

  const kinds = useMemo(() => {
    const present = new Set(posts.map((post) => post.kind));
    return (Object.keys(KIND_LABEL) as FeedSlot[]).filter((item) =>
      present.has(item)
    );
  }, [posts]);

  const timeline = useMemo(
    () =>
      [
        ...posts.map((post) => ({ type: "app" as const, post })),
        ...userTimeline.posts.map((post) => ({ type: "user" as const, post })),
      ].sort(
        (a, b) =>
          b.post.createdAt - a.post.createdAt ||
          a.post.id.localeCompare(b.post.id)
      ),
    [posts, userTimeline.posts]
  );
  useEffect(() => {
    if (kind && kind !== "user" && !kinds.includes(kind)) setKind(null);
  }, [kind, kinds]);

  const pages = useMemo(
    () => [null, "user", ...kinds] as FeedCategory[],
    [kinds]
  );
  const pageRows = useMemo(
    () =>
      pages.map((category) => ({
        category,
        items: timeline.filter(
          (item) =>
            category === null ||
            (item.type === "user"
              ? category === "user"
              : item.post.kind === category)
        ),
      })),
    [pages, timeline]
  );
  const pager = useFeedPager({
    categories: pages,
    selected: kind,
    onSelect: setKind,
  });
  const open = useCallback(
    async (appId: string) => {
      const at = latest[appId] ?? Date.now();
      if (await onOpen(appId)) markSeen(appId, at);
    },
    [latest, onOpen]
  );

  const renderPost = useCallback(
    ({ item }: { item: (typeof timeline)[number] }) => {
      if (item.type === "user") {
        const post =
          user && item.post.author.id === user.id
            ? {
                ...item.post,
                author: {
                  id: user.id,
                  name: user.name,
                  avatarUrl: user.avatarUrl,
                },
              }
            : item.post;
        return (
          <View style={styles.post}>
            <UserPostCard
              post={post}
              time={formatWhen(post.createdAt)}
              own={user?.id === post.author.id}
              onOpen={() => onPost(post)}
              onApplication={onApplication}
              onAuthor={onAuthor}
            />
          </View>
        );
      }
      const post = item.post;
      const friend = friends.get(post.appId) ?? {
        id: post.appId,
        name: post.appId,
        mark: "友",
        accent: colors.accent,
      };
      const Template =
        cardsReady >= 0 && post.kind !== "summary"
          ? peekFeedTemplate(post.appId, post.kind as FeedKind)
          : undefined;
      return (
        <View>
          <View style={styles.post}>
            <CardSlot
              Template={Template}
              card={{
                post,
                friend,
                kindLabel: KIND_LABEL[post.kind],
                time: formatWhen(post.createdAt),
                unread: post.createdAt > (seen[post.appId] ?? 0),
                liked: liked.has(post.id),
                onOpen: () => open(post.appId),
                onLike: () => toggleLike(post.id),
                onReply: () => onReply(post.appId),
              }}
            />
          </View>
        </View>
      );
    },
    [
      user,
      onPost,
      onApplication,
      onAuthor,
      cardsReady,
      friends,
      colors.accent,
      seen,
      liked,
      open,
      onReply,
      timeTick,
    ]
  );

  return (
    <ThemeContext.Provider value={themeContext}>
      <FeedPresentationContext.Provider value={feedPresentation}>
        <GestureHandlerRootView style={styles.container}>
          <View style={styles.container}>
            <View
              style={styles.viewport}
              onLayout={(event) =>
                setViewportSize(event.nativeEvent.layout.height)
              }
            >
              <Animated.View
                onLayout={(event) => {
                  const height = event.nativeEvent.layout.height;
                  headerHeight.value = height;
                  setHeaderSize(height);
                }}
                style={[
                  styles.floatingHeader,
                  { paddingTop: insets.top },
                  headerMotion,
                ]}
              >
                <View style={styles.header}>
                  <View style={styles.headerRow}>
                    <Pressy
                      accessibilityRole="button"
                      accessibilityLabel="打开我的侧边抽屉"
                      onPress={onProfile}
                      scale={0.92}
                      style={styles.profileControl}
                    >
                      {user?.avatarUrl ? (
                        <AppImage
                          source={{ uri: user.avatarUrl }}
                          style={styles.profileAvatar}
                        />
                      ) : (
                        <PixelAvatar size={36} />
                      )}
                    </Pressy>
                    <View style={styles.headerCopy}>
                      <Text style={styles.wordmark}>
                        动态<Text style={styles.brand}> / 紫金花</Text>
                      </Text>
                      <Text style={styles.headerCaption} numberOfLines={1}>
                        {summarizing ? "正在整理动态…" : "应用近况与社区分享"}
                      </Text>
                    </View>
                  </View>
                  <FeedCategoryTabs
                    categories={pages}
                    selected={kind}
                    position={pager.pagePosition}
                    onSelect={setKind}
                  />
                </View>
              </Animated.View>

              <GestureDetector gesture={gesture}>
                <View style={styles.pullHost}>
                  <GestureDetector gesture={pager.nativeGesture}>
                    <AnimatedPagerView
                      ref={pager.ref}
                      initialPage={0}
                      style={styles.scroll}
                      layoutDirection="ltr"
                      offscreenPageLimit={1}
                      overScrollMode="never"
                      scrollEnabled={phase !== "refreshing" && phase !== "done"}
                      onPageSelected={pager.onPageSelected}
                      onPageScroll={pager.onPageScroll}
                    >
                      {pageRows.map(
                        ({ category: pageKind, items: visible }) => (
                          <View
                            key={pageKind ?? "all"}
                            collapsable={false}
                            style={{ width: "100%", height: "100%" }}
                          >
                            {pager.mounted.has(pageKind) ||
                            pageKind === kind ? (
                              <FeedListGesture
                                pull={gesture}
                                drawer={pager.gesture}
                                pager={pager.nativeGesture}
                              >
                                <Animated.FlatList
                                  data={visible}
                                  ItemSeparatorComponent={FeedSeparator}
                                  keyExtractor={(item) =>
                                    `${item.type}-${item.post.id}`
                                  }
                                  initialNumToRender={8}
                                  maxToRenderPerBatch={6}
                                  windowSize={7}
                                  removeClippedSubviews={false}
                                  style={styles.scroll}
                                  contentContainerStyle={[
                                    styles.content,
                                    bottomSpace,
                                    { minHeight: viewportSize + headerSize },
                                  ]}
                                  showsVerticalScrollIndicator={false}
                                  onScroll={
                                    pageKind === kind ? onScroll : undefined
                                  }
                                  scrollEventThrottle={16}
                                  overScrollMode="never"
                                  bounces={false}
                                  scrollEnabled={
                                    phase !== "refreshing" && phase !== "done"
                                  }
                                  ListHeaderComponent={
                                    <View>
                                      <View style={{ height: headerSize }} />
                                      <Animated.View style={refreshSpace}>
                                        <PullIndicator
                                          pull={pull}
                                          phase={phase}
                                        />
                                      </Animated.View>
                                      {timelineError ? (
                                        <Text
                                          style={{
                                            color: colors.ink3,
                                            padding: 16,
                                            fontSize: 12,
                                          }}
                                        >
                                          {timelineError}
                                        </Text>
                                      ) : null}
                                    </View>
                                  }
                                  ListEmptyComponent={
                                    <View style={styles.empty}>
                                      <PixelAvatar size={80} />
                                      <Text style={styles.emptyTitle}>
                                        {pageKind === "user"
                                          ? "还没有用户动态"
                                          : "这里还很安静"}
                                      </Text>
                                      <Text style={styles.emptyBody}>
                                        分享一个想法，或换个分类看看。
                                      </Text>
                                      <Pressy
                                        accessibilityLabel="发布第一条动态"
                                        onPress={onCompose}
                                        style={styles.compose}
                                      >
                                        <PixelIcon
                                          name="plus"
                                          size={14}
                                          color={colors.onAccent}
                                        />
                                        <Text
                                          style={{
                                            color: colors.onAccent,
                                            fontWeight: "700",
                                          }}
                                        >
                                          发第一条动态
                                        </Text>
                                      </Pressy>
                                    </View>
                                  }
                                  renderItem={renderPost}
                                  ListFooterComponent={
                                    <View>
                                      {(pageKind === null ||
                                        pageKind === "user") &&
                                      userTimeline.nextCursor ? (
                                        <Pressable
                                          disabled={loadingMore}
                                          onPress={() => {
                                            setLoadingMore(true);
                                            void loadMoreUserPosts()
                                              .catch((error) =>
                                                Toast.show({
                                                  type: "error",
                                                  text1: "加载失败",
                                                  text2: error.message,
                                                })
                                              )
                                              .finally(() =>
                                                setLoadingMore(false)
                                              );
                                          }}
                                          style={{
                                            alignItems: "center",
                                            padding: 16,
                                          }}
                                        >
                                          <Text
                                            style={{ color: colors.accentText }}
                                          >
                                            {loadingMore
                                              ? "正在加载…"
                                              : "加载更多用户动态"}
                                          </Text>
                                        </Pressable>
                                      ) : null}
                                      {visible.length > 0 &&
                                      (!userTimeline.nextCursor ||
                                        (pageKind !== null &&
                                          pageKind !== "user")) ? (
                                        <View style={styles.end}>
                                          <PixelIcon
                                            name="spark"
                                            size={16}
                                            color={colors.accentText}
                                          />
                                          <Text style={styles.endText}>
                                            已浏览全部动态
                                          </Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  }
                                />
                              </FeedListGesture>
                            ) : null}
                          </View>
                        )
                      )}
                    </AnimatedPagerView>
                  </GestureDetector>
                </View>
              </GestureDetector>
              <Animated.View style={[styles.composeDock, composePosition]}>
                <Pressy
                  accessibilityLabel="发布文字和图片动态"
                  onPress={onCompose}
                  scale={1}
                  style={[
                    styles.compose,
                    {
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      paddingHorizontal: 0,
                      justifyContent: "center",
                    },
                  ]}
                >
                  <PixelIcon name="plus" size={18} color={colors.onAccent} />
                </Pressy>
              </Animated.View>
            </View>
          </View>
        </GestureHandlerRootView>
      </FeedPresentationContext.Provider>
    </ThemeContext.Provider>
  );
});
function FeedListGesture({
  pull,
  drawer,
  pager,
  children,
}: {
  pull: ReturnType<typeof Gesture.Pan>;
  drawer: ReturnType<typeof Gesture.Pan>;
  pager: ReturnType<typeof Gesture.Native>;
  children: import("react").ReactElement;
}) {
  const native = useMemo(
    () =>
      Gesture.Native()
        .requireExternalGestureToFail(pull, drawer)
        .simultaneousWithExternalGesture(pager),
    [pull, drawer, pager]
  );
  return <GestureDetector gesture={native}>{children}</GestureDetector>;
}
function FeedSeparator() {
  return <View style={styles.separator} />;
}

const feedPresentation = { Text: PixelText, compact: true };

function formatWhen(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 60_000) return "刚刚";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)} 天前`;
  const date = new Date(ms);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    container: { flex: 1, backgroundColor: t.canvas },
    floatingHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: t.canvas,
    },
    viewport: { flex: 1, overflow: "hidden" },
    composeDock: { position: "absolute", right: 16, zIndex: 30 },
    compose: {
      minHeight: 44,
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 12,
      alignItems: "center",
      backgroundColor: t.accent,
      borderRadius: 0,
      borderWidth: 2,
      borderColor: t.accentSoft,
    },
    profileControl: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 0,
      marginLeft: -9,
      borderRadius: 22,
      overflow: "hidden",
    },
    profileAvatar: { width: 36, height: 36, borderRadius: 18 },
    header: {
      backgroundColor: t.canvas,
      paddingLeft: 16,
      paddingRight: 24,
      paddingBottom: 0,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingTop: 8,
    },
    headerCopy: { flex: 1, minWidth: 0, gap: 3 },
    wordmark: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: "900",
      color: t.cyanText,
    },
    brand: { fontSize: 11, fontWeight: "500", color: t.redText },
    headerCaption: { fontSize: 10, lineHeight: 15, color: t.ink3 },
    scroll: { flex: 1 },
    pullHost: { flex: 1, overflow: "hidden" },
    content: { paddingBottom: 16 },
    post: { paddingVertical: 3, paddingRight: 24 },
    separator: { height: 0.5, marginHorizontal: 16, backgroundColor: t.line },
    empty: {
      marginHorizontal: 16,
      padding: 24,
      borderWidth: 2,
      borderColor: t.line,
      backgroundColor: t.surface,
      alignItems: "center",
      gap: 10,
    },
    emptyTitle: {
      marginTop: 6,
      fontSize: 18,
      fontWeight: "700",
      color: t.ink1,
    },
    emptyBody: {
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
      color: t.ink3,
    },
    end: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingTop: 8,
      paddingBottom: 12,
    },
    endText: { fontSize: 11, color: t.ink3, fontFamily: t.mono },
  };
});
