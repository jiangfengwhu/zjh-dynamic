import { AnimatedFlashList, type FlashListProps, type FlashListRef } from "../AnimatedFlashList";
import { ListGesture } from "./ListGesture";
import { markStartup } from "../../runtime/startupTiming";
import { reconnectMessages } from "../social/api";
import { useLiveVersion } from "../liveEvents";
import { UserAvatar } from "../UserAvatar";
import { EmptyState } from "../EmptyState";
import { NewDataNotice } from "../NewDataNotice";
import { HostText as Text } from "./HostText";
import { PageSkeleton } from "../LoadingSkeleton";
import PagerView from "react-native-pager-view";
import { useFeedPager, type FeedCategory } from "./useFeedPager";
import { HostText } from "./HostText";
import { FeedPresentationContext } from "../../../../../packages/ui/feed/kit/FeedPresentation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
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
} from "react-native-reanimated";
import { Ambient, AmbientFill, Pressy } from "../../../../../packages/ui/chrome";
import { ThemeContext, createThemedStyles } from "../../../../../packages/ui/theme";
import { useTheme } from "../../../../../packages/ui/theme";
import { SymbolIcon } from "../../../../../packages/ui/chrome/SymbolIcon";
import NativePluginHost from "../../NativePluginHost";
import { useFeedChrome, SHELL_CHROME_THRESHOLD } from "./FeedChrome";
import { useAccount } from "../account";
import { PullIndicator } from "./PullIndicator";
import { usePullToRefresh } from "./pullToRefresh";
import {
  useUserPosts,
  refreshUserPosts,
  acceptUserPosts,
  userPostsLoaded,
  shouldRefreshUserPosts,
  loadMoreUserPosts,
  type UserPost,
} from "./userPosts";
import { UserPostCard } from "./UserPostCard";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { FeedCategoryTabs } from "./FeedCategoryTabs";
import { requireAccount } from "../account";
import { formatWhen } from "../formatTime";

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);
const FEED_PAGE_INSET = 0;
const FEED_HEADER_INSET = 12;
function timelineItemType({ post }: { post: UserPost }) {
  return post.content?.format === "html" ? "html" : post.images.length ? "images" : post.application ? "application" : "text";
}

type FeedProps = {
  onCompose: () => void;
  onPost: (post: UserPost) => void;
  onProfile: () => void;
  onApplication: (appId: string) => Promise<void>;
  onAuthor: (author: UserPost["author"]) => void;
};

export const FeedScreen = memo(function FeedScreen({
  onCompose,
  onPost,
  onProfile,
  onApplication,
  onAuthor,
}: FeedProps) {
  markStartup("feed-render-start");
  const styles = useStyles();

  const { user } = useAccount();
  const themeContext = useTheme();
  const { colors, mode } = themeContext;
  const insets = useSafeAreaInsets();
  const {
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
          window: colors.canvas,
          light: mode === "light",
        })
      ).catch(() => {});
    }, [colors.canvas, mode])
  );
  const feedVersion = useLiveVersion("feed");
  const seenFeedVersion = useRef<Record<string, number>>({});
  const userTimeline = useUserPosts();
  useEffect(() => {
    if (userTimeline.loaded) markStartup("feed-data-ready");
  }, [userTimeline.loaded]);
  const focused = useIsFocused();
  const lists = useRef<Partial<Record<FeedCategory, Pick<FlashListRef<unknown>, "scrollToOffset">>> >({});
  const [loadingMore, setLoadingMore] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState({
    recommended: true,
    following: true,
  });
  const [timelineErrors, setTimelineErrors] = useState({
    recommended: "",
    following: "",
  });
  const setTimelineError = useCallback(
    (category: FeedCategory, message: string) =>
      setTimelineErrors((previous) => ({ ...previous, [category]: message })),
    []
  );
  const [kind, selectCategory] = useState<FeedCategory>("recommended");
  const followingTimeline = useUserPosts("following", focused && kind === "following");
  const [timeTick, tickTime] = useState(0);
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => tickTime((value) => value + 1), 60000);
      return () => clearInterval(timer);
    }, [])
  );

  const scrollY = useSharedValue(0);
  const selectedKey = kind;
  const activeCategory = useSharedValue(selectedKey);
  const headerHeight = useSharedValue(insets.top + 52);
  const hiddenHeader = useSharedValue(0);
  const [headerSize, setHeaderSize] = useState(insets.top + 52);
  const [viewportSize, setViewportSize] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(0);
  const presentation = useMemo(() => ({ ...feedPresentation, rowWidth: viewportWidth > 0 ? viewportWidth - FEED_PAGE_INSET * 2 : undefined }), [viewportWidth]);
  const headerMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: -hiddenHeader.value }],
  }));
  const bottomSpace = useAnimatedStyle(() => ({
    paddingBottom: tabHeight.value + 16,
  }));
  useEffect(() => {
    runOnUI((key: typeof selectedKey) => {
      "worklet";
      activeCategory.value = key;
      bottomTravel.value = 0;
    })(selectedKey);
  }, [selectedKey, activeCategory, bottomTravel]);

  useFocusEffect(
    useCallback(() => {
      if ((seenFeedVersion.current[kind] ?? 0) === feedVersion && !shouldRefreshUserPosts(kind)) return;
      let live = true;
      const refresh = () => {
        if (!live) return;
        seenFeedVersion.current[kind] = feedVersion;
        setTimelineLoading((previous) => ({ ...previous, [kind]: true }));
        void refreshUserPosts(kind, true)
          .then(
            () => setTimelineError(kind, ""),
            () => setTimelineError(kind, "用户动态暂时未能同步，下拉可重试")
          )
          .finally(() =>
            setTimelineLoading((previous) => ({ ...previous, [kind]: false }))
          );
      };
      // Missing content is startup work. Only cached, silent refresh waits idle.
      if (!userPostsLoaded(kind)) {
        refresh();
        return () => { live = false; };
      }
      const task = requestIdleCallback(refresh);
      return () => { live = false; cancelIdleCallback(task); };
    }, [kind, setTimelineError, feedVersion])
  );

  const { pull, phase, gesture } = usePullToRefresh({
    scrollY,
    onRefresh: async () => {
      reconnectMessages();
      try {
        await refreshUserPosts(kind);
        setTimelineError(kind, "");
      } catch (error) {
        setTimelineError(kind, "用户动态暂时未能同步，下拉可重试");
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

  const timeline = useMemo(
    () => userTimeline.posts.map((post) => ({ type: "user" as const, post })),
    [userTimeline.posts]
  );
  const pages = useMemo(
    () => ["recommended", "following"] as FeedCategory[],
    []
  );
  const pageRows = useMemo(
    () => [
      { category: "recommended" as const, items: timeline, page: userTimeline },
      {
        category: "following" as const,
        items: followingTimeline.posts.map((post) => ({
          type: "user" as const,
          post,
        })),
        page: followingTimeline,
      },
    ],
    [timeline, userTimeline, followingTimeline]
  );
  const pager = useFeedPager({
    categories: pages,
    selected: kind,
    onSelect: selectCategory,
  });
  const renderPost = useCallback(
    ({ item }: { item: (typeof timeline)[number] }) => (
      <UserTimelineItem
        post={item.post}
        author={user}
        time={formatWhen(item.post.createdAt)}
        onPost={onPost}
        onApplication={onApplication}
        onAuthor={onAuthor}
      />
    ),
    [user, onPost, onApplication, onAuthor, timeTick]
  );

  return (
    <ThemeContext.Provider value={themeContext}>
      <FeedPresentationContext.Provider value={presentation}>
        <GestureHandlerRootView style={styles.container}>
          <View style={styles.container} onLayout={() => markStartup("feed-layout")}>
            <Ambient />
            <View
              style={styles.viewport}
              onLayout={(event) => {
                setViewportSize(event.nativeEvent.layout.height);
                setViewportWidth(event.nativeEvent.layout.width);
              }}
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
                <AmbientFill shift={hiddenHeader} />
                <View style={styles.header}>
                  <View style={styles.headerRow}>
                    <Pressy
                      accessibilityRole="button"
                      accessibilityLabel="打开我的侧边抽屉"
                      onPress={onProfile}
                      scale={0.92}
                      style={styles.profileControl}
                    >
                      <UserAvatar uri={user?.avatarUrl} size={34} style={styles.profileAvatar} />
                    </Pressy>
                    <View style={styles.headerTabs}>
                      <FeedCategoryTabs
                        selected={kind}
                        position={pager.pagePosition}
                        onSelect={selectCategory}
                      />
                    </View>
                    <View style={styles.headerBalance} />
                  </View>
                </View>
              </Animated.View>

              <GestureDetector gesture={gesture}>
                <View style={styles.pullHost}>
                  <GestureDetector gesture={pager.nativeGesture}>
                    <AnimatedPagerView
                      ref={pager.ref}
                      initialPage={pager.index}
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
                        ({ category: pageKind, items: visible, page }) => (
                          <View
                            key={pageKind}
                            collapsable={false}
                            style={{ width: "100%", height: "100%" }}
                          >
                            {viewportWidth > 0 && (pager.mounted.has(pageKind) ||
                            pageKind === kind) ? (
                              <FeedListGesture
                                pull={gesture}
                                drawer={pager.gesture}
                                pager={pager.nativeGesture}
                              >
                                <FeedScrollSurface
                                  onListReady={value => { lists.current[pageKind] = value ?? undefined; }}
                                  categoryKey={pageKind}
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
                                  getItemType={timelineItemType}
                                  style={styles.scroll}
                                  contentContainerStyle={[
                                    styles.content,
                                    bottomSpace,
                                    { minHeight: visible.length ? viewportSize + headerSize : viewportSize, flexGrow: 1 },
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
                                      {timelineErrors[pageKind] ? (
                                        <Text
                                          style={{
                                            color: colors.ink3,
                                            padding: 16,
                                            fontSize: 12,
                                          }}
                                        >
                                          {timelineErrors[pageKind]}
                                        </Text>
                                      ) : null}
                                    </View>
                                  }
                                  ListEmptyComponent={
                                    timelineLoading[pageKind] &&
                                    !userPostsLoaded(pageKind) &&
                                    (pageKind !== "following" || user) ? (
                                      <View style={{ padding: 16 }}>
                                        <PageSkeleton rows={4} shape="feed" />
                                      </View>
                                    ) : (
                                      <EmptyState style={{ paddingHorizontal: 0 }}><View style={styles.empty}>
                                        <Text style={styles.emptyTitle}>
                                          {pageKind === "following"
                                            ? user
                                              ? "还没有关注动态"
                                              : "登录后查看关注动态"
                                            : "这里还很安静"}
                                        </Text>
                                        <Text style={styles.emptyBody}>
                                          {pageKind === "following"
                                            ? user
                                              ? "点击动态作者头像，进入主页关注。"
                                              : "关注喜欢的创作者，不错过新的分享。"
                                            : "分享一个想法，记录你的创造。"}
                                        </Text>
                                        <Pressy
                                          accessibilityLabel={pageKind === "following" ? user ? "去发现创作者" : "登录" : "发布第一条动态"}
                                          onPress={
                                            pageKind === "following"
                                              ? user
                                                ? () =>
                                                    selectCategory(
                                                      "recommended"
                                                    )
                                                : () => {
                                                    void requireAccount();
                                                  }
                                              : onCompose
                                          }
                                          style={styles.compose}
                                        >
                                          <SymbolIcon
                                            name={pageKind === "following" ? "search" : "plus"}
                                            size={16}
                                            strokeWidth={2.4}
                                            color={colors.onAccent}
                                          />
                                          <Text
                                            style={{
                                              color: colors.onAccent,
                                              fontWeight: "700",
                                            }}
                                          >
                                            {pageKind === "following"
                                              ? user
                                                ? "去发现创作者"
                                                : "登录"
                                              : "发第一条动态"}
                                          </Text>
                                        </Pressy>
                                      </View></EmptyState>
                                    )
                                  }
                                  renderItem={renderPost}
                                  ListFooterComponent={
                                    <View>
                                      {page.nextCursor ? (
                                        <Pressable
                                          disabled={loadingMore}
                                          onPress={() => {
                                            setLoadingMore(true);
                                            void loadMoreUserPosts(pageKind)
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
                                          {loadingMore ? (
                                            <ActivityIndicator color={colors.ink2} />
                                          ) : (
                                            <Text
                                              style={{
                                                color: colors.orchidText,
                                                fontWeight: "600",
                                              }}
                                            >
                                              加载更多动态
                                            </Text>
                                          )}
                                        </Pressable>
                                      ) : null}
                                      {visible.length > 0 &&
                                      !page.nextCursor ? (
                                        <View style={styles.end}>
                                          <View style={{ flex: 1, height: colors.components.surfaceBorder, backgroundColor: colors.lineStrong }} />
                                          <Text style={styles.endText}>
                                            已浏览全部动态
                                          </Text>
                                          <View style={{ flex: 1, height: colors.components.surfaceBorder, backgroundColor: colors.lineStrong }} />
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
                    {(kind === "following" ? followingTimeline : userTimeline).pending ? <NewDataNotice top={headerSize + 8} label="已发布 · 查看新动态" avatars={(kind === "following" ? followingTimeline : userTimeline).pending!.posts.map(post => post.author.avatarUrl).filter((uri): uri is string => !!uri).filter((uri, index, list) => list.indexOf(uri) === index)} onPress={() => { acceptUserPosts(kind); lists.current[kind]?.scrollToOffset({ offset: 0, animated: false }); }} /> : null}
                </View>
              </GestureDetector>
            </View>
          </View>
        </GestureHandlerRootView>
      </FeedPresentationContext.Provider>
    </ThemeContext.Provider>
  );
});
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
  const styles = useStyles();

  const own = author?.id === original.author.id;
  const post = useMemo(
    () => (own && author ? { ...original, author } : original),
    [original, own, author]
  );
  const open = useCallback(() => onPost(post), [onPost, post]);
  return (
    <View collapsable={false} style={styles.post}>
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
/** Lists share only the header range. Body offsets stay on their native list. */
const FeedScrollSurface = memo(
  FeedScrollSurfaceImpl
) as typeof FeedScrollSurfaceImpl;
function FeedScrollSurfaceImpl<Item>({
  onListReady,
  getItemType,
  renderScrollComponent,
  categoryKey,
  activeCategory,
  hiddenHeader,
  headerHeight,
  chromeHidden,
  bottomTravel,
  scrollY,
  ...props
}: FlashListProps<Item> & {
  onListReady?: (value: FlashListRef<Item> | null) => void;
  getItemType?: FlashListProps<Item>["getItemType"];
  renderScrollComponent?: FlashListProps<Item>["renderScrollComponent"];
  categoryKey: string;
  activeCategory: SharedValue<FeedCategory>;
  hiddenHeader: SharedValue<number>;
  headerHeight: SharedValue<number>;
  chromeHidden: SharedValue<number>;
  bottomTravel: SharedValue<number>;
  scrollY: SharedValue<number>;
}) {
  const ref = useAnimatedRef<FlashListRef<Item>>();
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
  return <AnimatedFlashList maintainVisibleContentPosition={{ disabled: true }}
    {...props}
    ref={value => { ref(value); onListReady?.(value); }}
    onScroll={onScroll}
    getItemType={getItemType}
    renderScrollComponent={renderScrollComponent}
    drawDistance={250}
    onContentSizeChange={(_width, height) => { if (height > 0) ready.value = true; }}
  />;
}

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
  return <ListGesture gesture={native}>{children}</ListGesture>;
}
function FeedSeparator() {
  const styles = useStyles();

  return <View style={styles.separator} />;
}

const feedPresentation = { Text: HostText, compact: true, frameInset: 16 };

const useStyles = createThemedStyles((base) => {
  const t = base;
  return {
    container: { flex: 1, backgroundColor: t.canvas },
    floatingHeader: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
    },
    viewport: { flex: 1, overflow: "hidden" },
    compose: {
      minHeight: 40,
      flexDirection: "row",
      gap: 6,
      marginTop: 4,
      paddingHorizontal: 18,
      alignItems: "center",
      backgroundColor: t.accent,
      borderRadius: t.radius.pill,
      borderWidth: 0,
    },
    profileControl: {
      width: 40,
      height: 40,
      minWidth: 40,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 0,
      marginLeft: 0,
      borderRadius: 20,
      overflow: "hidden",
    },
    profileAvatar: { width: 30, height: 30, borderRadius: 15 },
    header: {
      paddingLeft: FEED_HEADER_INSET,
      paddingRight: FEED_HEADER_INSET,
      paddingBottom: 0,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingTop: 2,
      paddingBottom: 4,
    },
    headerTabs: { flex: 1, minWidth: 0, alignItems: "center" },
    headerBalance: { width: 40, height: 40 },
    scroll: { flex: 1 },
    pullHost: { flex: 1, overflow: "hidden" },
    content: { paddingBottom: 16, paddingHorizontal: FEED_PAGE_INSET },
    post: {
      width: "100%",
      minWidth: 0,
      overflow: "visible",
    },
    separator: {
      height: t.components.surfaceBorder,
      backgroundColor: t.line,
    },
    empty: {
      marginHorizontal: 16,
      marginTop: 24,
      paddingHorizontal: 20,
      paddingVertical: 24,
      alignItems: "center",
      gap: 8,
    },
    emptyTitle: {
      ...t.type.title2,
      color: t.ink1,
    },
    emptyBody: {
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      color: t.ink3,
      marginBottom: 6,
    },
    end: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingTop: 20,
      paddingBottom: 12,
      paddingHorizontal: 48,
    },
    endText: { ...t.type.overline, fontSize: 11, color: t.ink3 },
  };
});
