import { PixelText as Text } from "./PixelText";
import { PixelText } from "./PixelText";
import { FeedPresentationContext } from "../../../../../packages/ui/feed/kit/FeedPresentation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, View } from "react-native";
import {
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
  ReduceMotion,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  cancelAnimation,
  withDelay,
  withTiming,
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
import { useFeedChrome } from "./FeedChrome";
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
import { useNotificationCount } from "./notifications";

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
  onNotifications: () => void;
};

export const FeedScreen = memo(function FeedScreen({
  onOpen,
  onReply,
  onCompose,
  onPost,
  onProfile,
  onApplication,
  onAuthor,
  onNotifications,
  installedIds,
}: FeedProps) {
  const { user } = useAccount();
  const themeContext = usePixelTheme();
  const { colors, mode } = themeContext;
  const insets = useSafeAreaInsets();
  const { hidden: chromeHidden, tabHeight } = useFeedChrome();
  // Android already draws both system bar backgrounds transparently. Keep their
  // visibility fixed; only the app's header and tabs respond to scrolling.
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
          immersive: false,
        })
      ).catch(() => {});
    }, [colors.canvas, mode])
  );
  const userTimeline = useUserPosts();
  const unreadNotifications = useNotificationCount();
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
  const [, tickTime] = useState(0);
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => tickTime((value) => value + 1), 60000);
      return () => clearInterval(timer);
    }, [])
  );

  const scrollY = useSharedValue(0);
  const list = useRef<FlatList<(typeof timeline)[number]>>(null);
  const headerHeight = useSharedValue(144);
  const hiddenHeader = useSharedValue(0);
  const dragging = useSharedValue(false);
  const momentum = useSharedValue(false);
  const direction = useSharedValue(0);
  const layoutSize = useSharedValue({ viewport: 0, content: 0 });
  const [headerSize, setHeaderSize] = useState(144);
  const [viewportSize, setViewportSize] = useState(0);
  useAnimatedReaction(
    () =>
      headerHeight.value > 0 ? hiddenHeader.value / headerHeight.value : 0,
    (progress) => {
      chromeHidden.value = progress;
    }
  );
  function settleHeader(delay = 0) {
    "worklet";
    const hide =
      scrollY.value > 1 &&
      (direction.value > 0 ||
        (direction.value === 0 && hiddenHeader.value > headerHeight.value / 2));
    const animation = withTiming(hide ? headerHeight.value : 0, {
      duration: 180,
      reduceMotion: ReduceMotion.System,
    });
    hiddenHeader.value = delay ? withDelay(delay, animation) : animation;
  }
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: (event) => {
      cancelAnimation(hiddenHeader);
      dragging.value = true;
      momentum.value = false;
      direction.value = 0;
      scrollY.value = Math.max(0, event.contentOffset.y);
      layoutSize.value = {
        viewport: event.layoutMeasurement.height,
        content: event.contentSize.height,
      };
    },
    onMomentumBegin: () => {
      cancelAnimation(hiddenHeader);
      momentum.value = true;
    },
    onScroll: (event) => {
      const next = Math.max(0, event.contentOffset.y);
      const size = {
        viewport: event.layoutMeasurement.height,
        content: event.contentSize.height,
      };
      const resized =
        Math.abs(size.viewport - layoutSize.value.viewport) > 0.5 ||
        Math.abs(size.content - layoutSize.value.content) > 0.5;
      layoutSize.value = size;
      // A finger drag remains authoritative even when a card changes its size.
      // Ignore layout-only offset changes outside an active drag.
      if (dragging.value || (momentum.value && !resized)) {
        const delta = next - scrollY.value;
        if (Math.abs(delta) > 0.5) direction.value = delta > 0 ? 1 : -1;
        hiddenHeader.value =
          next === 0
            ? 0
            : Math.max(
                0,
                Math.min(headerHeight.value, hiddenHeader.value + delta)
              );
      }
      scrollY.value = next;
    },
    // A fling cancels this delayed snap; a drag without momentum still finishes.
    onEndDrag: () => {
      dragging.value = false;
      settleHeader(120);
    },
    onMomentumEnd: () => {
      momentum.value = false;
      // Android can deliver the interrupted fling's end after a new drag begins.
      // It must not stop or snap the header underneath the finger.
      if (!dragging.value) settleHeader();
    },
  });
  const headerMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: -hiddenHeader.value }],
  }));
  const bottomSpace = useAnimatedStyle(() => ({
    paddingBottom: tabHeight.value + 68,
  }));
  const composePosition = useAnimatedStyle(() => ({
    bottom:
      Math.max(insets.bottom, tabHeight.value * (1 - chromeHidden.value)) + 12,
  }));
  useFocusEffect(
    useCallback(() => {
      cancelAnimation(hiddenHeader);
      chromeHidden.value = 0;
      hiddenHeader.value = 0;
      dragging.value = false;
      momentum.value = false;
    }, [chromeHidden, hiddenHeader, dragging, momentum])
  );
  const edge = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP),
  }));

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

  const { pull, phase, gesture, scrollGesture } = usePullToRefresh({
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
  const visible = useMemo(
    () =>
      timeline.filter(
        (item) =>
          !kind ||
          (item.type === "user" ? kind === "user" : item.post.kind === kind)
      ),
    [timeline, kind]
  );

  useEffect(() => {
    if (kind && kind !== "user" && !kinds.includes(kind)) setKind(null);
  }, [kind, kinds]);

  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
    cancelAnimation(hiddenHeader);
    scrollY.value = 0;
    hiddenHeader.value = 0;
    chromeHidden.value = 0;
    dragging.value = false;
    momentum.value = false;
  }, [kind, scrollY, hiddenHeader, chromeHidden, dragging, momentum]);

  const open = useCallback(
    async (appId: string) => {
      const at = latest[appId] ?? Date.now();
      if (await onOpen(appId)) markSeen(appId, at);
    },
    [latest, onOpen]
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
                    <View style={styles.headerCopy}>
                      <Text style={styles.wordmark}>
                        动态<Text style={styles.brand}> / 紫金花</Text>
                      </Text>
                      <Text style={styles.headerCaption} numberOfLines={1}>
                        {summarizing ? "正在整理动态…" : "应用近况与社区分享"}
                      </Text>
                    </View>
                    <Pressy
                      accessibilityRole="button"
                      accessibilityLabel={`查看通知${
                        unreadNotifications
                          ? `，${unreadNotifications}条未读`
                          : ""
                      }`}
                      onPress={onNotifications}
                      style={styles.notification}
                    >
                      <PixelIcon name="bell" size={20} color={colors.ink2} />
                      {unreadNotifications > 0 ? (
                        <View style={styles.notificationCount}>
                          <Text style={{ fontSize: 9, color: colors.onAccent }}>
                            {unreadNotifications > 99
                              ? "99+"
                              : unreadNotifications}
                          </Text>
                        </View>
                      ) : null}
                    </Pressy>

                    <Pressy
                      accessibilityRole="button"
                      accessibilityLabel="打开我的页面"
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
                        <PixelAvatar size={34} />
                      )}
                    </Pressy>
                  </View>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.headerEdge, edge]}
                  />
                </View>
              </Animated.View>

              <GestureDetector gesture={gesture}>
                <View style={styles.pullHost}>
                  <View style={styles.scroll}>
                    <GestureDetector gesture={scrollGesture}>
                      <Animated.FlatList
                        ref={list}
                        data={visible}
                        keyExtractor={(item) => `${item.type}-${item.post.id}`}
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
                        showsVerticalScrollIndicator
                        onScroll={onScroll}
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
                              <PullIndicator pull={pull} phase={phase} />
                            </Animated.View>
                            <View style={styles.timelineHeading}>
                              <Text style={styles.timelineTitle}>最新动态</Text>
                              <Text style={styles.timelineCount}>
                                {visible.length} 条
                              </Text>
                            </View>
                            <ScrollView
                              horizontal
                              showsHorizontalScrollIndicator
                              contentContainerStyle={styles.tabs}
                            >
                              <Tab
                                label="全部"
                                active={kind === null}
                                onPress={() => setKind(null)}
                              />
                              <Tab
                                label="用户"
                                active={kind === "user"}
                                onPress={() => setKind("user")}
                              />
                              {kinds.map((item) => (
                                <Tab
                                  key={item}
                                  label={KIND_LABEL[item]}
                                  active={kind === item}
                                  onPress={() => setKind(item)}
                                />
                              ))}
                            </ScrollView>
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
                              {kind === "user"
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
                        renderItem={({ item }) => {
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
                              ? peekFeedTemplate(
                                  post.appId,
                                  post.kind as FeedKind
                                )
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
                                    unread:
                                      post.createdAt > (seen[post.appId] ?? 0),
                                    liked: liked.has(post.id),
                                    onOpen: () => open(post.appId),
                                    onLike: () => toggleLike(post.id),
                                    onReply: () => onReply(post.appId),
                                  }}
                                />
                              </View>
                            </View>
                          );
                        }}
                        ListFooterComponent={
                          <View>
                            {(!kind || kind === "user") &&
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
                                    .finally(() => setLoadingMore(false));
                                }}
                                style={{ alignItems: "center", padding: 16 }}
                              >
                                <Text style={{ color: colors.accentText }}>
                                  {loadingMore
                                    ? "正在加载…"
                                    : "加载更多用户动态"}
                                </Text>
                              </Pressable>
                            ) : null}
                            {visible.length > 0 &&
                            (!userTimeline.nextCursor ||
                              (kind && kind !== "user")) ? (
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
                    </GestureDetector>
                  </View>
                </View>
              </GestureDetector>
              <Animated.View style={[styles.composeDock, composePosition]}>
                <Pressy
                  accessibilityLabel="发布文字和图片动态"
                  onPress={onCompose}
                  scale={1}
                  style={styles.compose}
                >
                  <PixelIcon name="plus" size={18} color={colors.onAccent} />
                  <Text style={{ fontSize: 12, color: colors.onAccent }}>
                    发动态
                  </Text>
                </Pressy>
              </Animated.View>
            </View>
          </View>
        </GestureHandlerRootView>
      </FeedPresentationContext.Provider>
    </ThemeContext.Provider>
  );
});
const feedPresentation = { Text: PixelText, compact: true };

/** 分类切换用字重和短线共同标识选中状态。 */
function Tab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = usePixelTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tab,
        pressed && { backgroundColor: colors.inset },
      ]}
    >
      <View style={styles.tabInner}>
        <Text style={[styles.tabText, active && styles.tabTextActive]}>
          {label}
        </Text>
        <View
          style={[styles.tabBar, active && { backgroundColor: colors.accent }]}
        />
      </View>
    </Pressable>
  );
}

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
    notification: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    notificationCount: {
      position: "absolute",
      top: 0,
      right: 0,
      minWidth: 16,
      paddingHorizontal: 3,
      height: 16,
      backgroundColor: t.accent,
      alignItems: "center",
      justifyContent: "center",
    },
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
      borderWidth: 2,
      borderColor: t.line,
      marginLeft: 4,
    },
    profileAvatar: { width: 34, height: 34, borderRadius: 0 },
    header: {
      backgroundColor: t.canvas,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingTop: 8,
    },
    headerCopy: { flex: 1, minWidth: 0, gap: 3 },
    wordmark: {
      fontSize: 24,
      lineHeight: 32,
      fontWeight: "900",
      color: t.ink1,
    },
    brand: { fontSize: 11, fontWeight: "500", color: t.ink3 },
    headerCaption: { fontSize: 10, lineHeight: 15, color: t.ink3 },
    headerEdge: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: 2,
      backgroundColor: t.lineStrong,
    },
    scroll: { flex: 1 },
    pullHost: { flex: 1, overflow: "hidden" },
    content: { paddingBottom: 16 },
    tabs: {
      flexDirection: "row",
      paddingHorizontal: 8,
      paddingBottom: 4,
      gap: 2,
    },
    tab: { paddingHorizontal: 10, alignItems: "center", minWidth: 52 },
    tabInner: {
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      height: 44,
    },
    tabText: {
      fontSize: 13,
      fontWeight: "500",
      color: t.ink3,
    },
    tabTextActive: { color: t.ink1, fontWeight: "800" },
    tabBar: {
      width: 16,
      height: 4,
      borderRadius: 0,
      backgroundColor: "transparent",
    },
    timelineHeading: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 2,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    timelineTitle: { fontSize: 15, fontWeight: "800", color: t.ink1 },
    timelineCount: { fontSize: 10, color: t.ink3, fontFamily: t.mono },
    post: { borderBottomWidth: 1, borderBottomColor: t.line },
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
