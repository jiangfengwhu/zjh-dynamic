import { PixelText as Text } from "./PixelText";
import { FeedCategoryTabs } from "./FeedCategoryTabs";
import PagerView from "react-native-pager-view";
import { useFeedPager, type FeedCategory } from "./useFeedPager";
import { PixelText } from "./PixelText";
import {
  COMPACT_FEED_INSET,
  FeedPresentationContext,
} from "../../../../../packages/ui/feed/kit/FeedPresentation";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { FlatList, Pressable, View, type FlatListProps } from "react-native";
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
  runOnUI,
  useAnimatedRef,
  useAnimatedReaction,
  scrollTo,
  type SharedValue,
  type AnimatedProps,
} from "react-native-reanimated";
import { bundles } from "../../../../../packages/features/src/registry";
import {
  KIND_LABEL,
  peekFeedTemplate,
  readFeedPosts,
  subscribeFeedPosts,
  subscribeFeedTemplates,
  type FeedFriend,
  type FeedCardProps,
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
import {
  useFeedChrome,
  SHELL_BOTTOM_PADDING,
  SHELL_CHROME_THRESHOLD,
} from "./FeedChrome";
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
  const {
    hidden: chromeHidden,
    target: chromeTarget,
    travel: bottomTravel,
    tabHeight,
  } = useFeedChrome();
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
  const headerHeight = useSharedValue(144);
  const hiddenHeader = useSharedValue(0);
  const [headerSize, setHeaderSize] = useState(144);
  const [viewportSize, setViewportSize] = useState(0);
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
  useEffect(() => {
    runOnUI((key: string) => {
      "worklet";
      activeCategory.value = key;
      bottomTravel.value = 0;
    })(selectedKey);
  }, [selectedKey, activeCategory, bottomTravel]);

  useEffect(() => subscribeFeedPosts(setPosts), []);
  useEffect(() => subscribeSeen(setSeen), []);
  useEffect(() => subscribeLikes(setLikes), []);
  useEffect(
    () => subscribeFeedTemplates(() => setCardsReady((value) => value + 1)),
    []
  );
  useEffect(() => subscribeFeedSummaryBusy(setSummarizing), []);
  useEffect(() => {
    const task = requestIdleCallback(() => {
      void refreshUserPosts().then(
        () => setTimelineError(""),
        () => setTimelineError("用户动态暂时未能同步，下拉可重试")
      );
    });
    return () => cancelIdleCallback(task);
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
        return (
          <UserTimelineItem
            post={item.post}
            author={user}
            time={formatWhen(item.post.createdAt)}
            onPost={onPost}
            onApplication={onApplication}
            onAuthor={onAuthor}
          />
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
        <ApplicationTimelineItem
          post={post}
          friend={friend}
          Template={Template}
          time={formatWhen(post.createdAt)}
          unread={post.createdAt > (seen[post.appId] ?? 0)}
          liked={liked.has(post.id)}
          onOpen={open}
          onReply={onReply}
        />
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
                      onPageScrollStateChanged={pager.onPageScrollStateChanged}
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
                                <FeedScrollSurface
                                  categoryKey={pageKind ?? "all"}
                                  activeCategory={activeCategory}
                                  hiddenHeader={hiddenHeader}
                                  headerHeight={headerHeight}
                                  chromeHidden={chromeTarget}
                                  bottomTravel={bottomTravel}
                                  scrollY={scrollY}
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
type FeedTimelineItem =
  | { type: "app"; post: FeedPost }
  | { type: "user"; post: UserPost };
const UserTimelineItem = memo(function UserTimelineItem({
  post: original,
  author,
  time,
  onPost,
  onApplication,
  onAuthor,
}: {
  post: UserPost;
  author: UserPost["author"] | null;
  time: string;
  onPost: FeedProps["onPost"];
  onApplication: FeedProps["onApplication"];
  onAuthor: FeedProps["onAuthor"];
}) {
  const own = author?.id === original.author.id;
  const post = useMemo(
    () => (own && author ? { ...original, author } : original),
    [original, own, author]
  );
  const open = useCallback(() => onPost(post), [onPost, post]);
  return (
    <View style={styles.post}>
      <UserPostCard
        post={post}
        time={time}
        own={own}
        onOpen={open}
        onApplication={onApplication}
        onAuthor={onAuthor}
      />
    </View>
  );
});
const ApplicationTimelineItem = memo(function ApplicationTimelineItem({
  post,
  friend,
  Template,
  time,
  unread,
  liked,
  onOpen,
  onReply,
}: {
  post: FeedPost;
  friend: FeedFriend;
  Template?: ComponentType<FeedCardProps>;
  time: string;
  unread: boolean;
  liked: boolean;
  onOpen: (id: string) => Promise<void>;
  onReply: FeedProps["onReply"];
}) {
  const open = useCallback(() => {
    void onOpen(post.appId);
  }, [onOpen, post.appId]);
  const like = useCallback(() => toggleLike(post.id), [post.id]);
  const reply = useCallback(() => onReply(post.appId), [onReply, post.appId]);
  const card = useMemo(
    () => ({
      post,
      friend,
      kindLabel: KIND_LABEL[post.kind],
      time,
      unread,
      liked,
      onOpen: open,
      onLike: like,
      onReply: reply,
    }),
    [post, friend, time, unread, liked, open, like, reply]
  );
  return (
    <View style={styles.post}>
      <CardSlot Template={Template} card={card} />
    </View>
  );
});

/** Lists share only the header range. Body offsets stay on their native list. */
const FeedScrollSurface = memo(function FeedScrollSurface({
  categoryKey,
  activeCategory,
  hiddenHeader,
  headerHeight,
  chromeHidden,
  bottomTravel,
  scrollY,
  ...props
}: AnimatedProps<FlatListProps<FeedTimelineItem>> & {
  categoryKey: string;
  activeCategory: SharedValue<string>;
  hiddenHeader: SharedValue<number>;
  headerHeight: SharedValue<number>;
  chromeHidden: SharedValue<number>;
  bottomTravel: SharedValue<number>;
  scrollY: SharedValue<number>;
}) {
  const ref = useAnimatedRef<FlatList<FeedTimelineItem>>();
  const ready = useSharedValue(false);
  const offset = useSharedValue(0);
  const dragging = useSharedValue(false);
  const momentum = useSharedValue(false);
  const onScroll = useAnimatedScrollHandler(
    {
      onBeginDrag: (event) => {
        dragging.value = true;
        offset.value = Math.max(0, event.contentOffset.y);
        if (activeCategory.value === categoryKey) {
          scrollY.value = offset.value;
          bottomTravel.value = 0;
        }
      },
      onScroll: (event) => {
        const next = Math.max(0, event.contentOffset.y);
        const delta = next - offset.value;
        offset.value = next;
        if (activeCategory.value !== categoryKey) return;
        scrollY.value = next;
        if (!dragging.value && !momentum.value) return;
        hiddenHeader.value =
          next === 0 && delta < 0
            ? 0
            : Math.max(
                0,
                Math.min(headerHeight.value, hiddenHeader.value + delta)
              );
        // Bottom chrome has only two states. A direction reversal resets
        // accumulated travel so tiny scroll corrections cannot flicker it.
        if (next === 0) {
          chromeHidden.value = 0;
          bottomTravel.value = 0;
        } else if (Math.abs(delta) > 0.1) {
          bottomTravel.value =
            delta * bottomTravel.value < 0 ? delta : bottomTravel.value + delta;
          if (bottomTravel.value >= SHELL_CHROME_THRESHOLD) {
            chromeHidden.value = 1;
            bottomTravel.value = 0;
          } else if (bottomTravel.value <= -SHELL_CHROME_THRESHOLD) {
            chromeHidden.value = 0;
            bottomTravel.value = 0;
          }
        }
      },
      onEndDrag: () => {
        dragging.value = false;
      },
      onMomentumBegin: () => {
        momentum.value = true;
      },
      onMomentumEnd: () => {
        momentum.value = false;
      },
    },
    [categoryKey]
  );
  useAnimatedReaction(
    () => ({
      active: activeCategory.value === categoryKey,
      header: hiddenHeader.value,
      ready: ready.value,
    }),
    (state, previous) => {
      if (!state.ready) return;
      if (state.active) {
        // A page first mounted while chrome is hidden starts in the shared
        // header range, before the user can begin scrolling its body.
        if (
          !previous?.ready &&
          !dragging.value &&
          offset.value < state.header
        ) {
          offset.value = state.header;
          scrollTo(ref, 0, state.header, false);
        }
        if (!previous?.active || !previous.ready) scrollY.value = offset.value;
        return;
      }
      // Synchronize only lists inside the shared header range. Never touch
      // a category's body reading position or scroll the active finger's list.
      if (
        offset.value <= headerHeight.value &&
        Math.abs(offset.value - state.header) > 0.5
      ) {
        offset.value = state.header;
        scrollTo(ref, 0, state.header, false);
      }
    },
    [categoryKey]
  );
  return (
    <Animated.FlatList
      {...props}
      ref={ref}
      onScroll={onScroll}
      onContentSizeChange={(_width, height) => {
        if (height > 0) ready.value = true;
      }}
    />
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
    post: { paddingVertical: 3 },
    separator: {
      height: 0.5,
      marginHorizontal: COMPACT_FEED_INSET,
      backgroundColor: t.line,
    },
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
