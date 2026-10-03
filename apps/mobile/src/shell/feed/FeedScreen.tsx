import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Extrapolation,
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
import { Icon, Pressy } from "../../../../../packages/ui/chrome";
const bootstrap = require("../../../../../tools/applications/bootstrap.json");
function DefaultAvatar({ size }: { size: number }) {
  const Avatar = bundles.find(item => item.id === bootstrap.defaultApplication)?.avatar;
  return Avatar ? <Avatar size={size} /> : <Icon name="workshop" size={size} />;
}
import { themedStyleSheet, useTheme } from "../../../../../packages/ui/theme";
import NativePluginHost from "../../NativePluginHost";
import { useFeedChrome } from "./FeedChrome";
import { subscribeFeedSummaryBusy } from "./summary";
import { FriendRail } from "./FriendRail";
import { useAccount } from "../account";
import { CardSlot } from "./CardSlot";
import { PullIndicator } from "./PullIndicator";
import { usePullToRefresh } from "./pullToRefresh";
import { subscribeLikes, toggleLike } from "./likes";
import { markSeen, subscribeSeen, type SeenMap } from "./seen";
import { useUserPosts, refreshUserPosts, loadMoreUserPosts, type UserPost } from "./userPosts";
import { UserPostCard } from "./UserPostCard";
import Toast from "react-native-toast-message";
import FastImage from "@d11/react-native-fast-image";
import { Bell } from "lucide-react-native";
import { useNotificationCount } from "./notifications";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];


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

export const FeedScreen = memo(function FeedScreen({ onOpen, onReply, onNew, onCompose, onPost, onProfile, onApplication, onAuthor, onNotifications, installedIds }: FeedProps) {
  const { user } = useAccount();
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { hidden: chromeHidden, tabHeight } = useFeedChrome();
  // Android already draws both system bar backgrounds transparently. Keep their
  // visibility fixed; only the app's header and tabs respond to scrolling.
  useFocusEffect(useCallback(() => {
    void NativePluginHost.call("shell", "systemBars", JSON.stringify({ statusBar: colors.canvas, navigationBar: colors.canvas, window: colors.canvas, light: mode === "light", immersive: false })).catch(() => {});
  }, [colors.canvas, mode]));
  const userTimeline = useUserPosts();
  const unreadNotifications = useNotificationCount();
  const [loadingMore, setLoadingMore] = useState(false);
  const [timelineError, setTimelineError] = useState("");
  const [allPosts, setPosts] = useState<FeedPost[]>(() => readFeedPosts());
  const posts = useMemo(() => allPosts.filter(post => installedIds.includes(post.appId) && (post.appId !== bootstrap.defaultApplication || !post.payload.workshopPost || Boolean(user && post.payload.ownerId === user.id))), [allPosts, installedIds, user?.id]);
  const [seen, setSeen] = useState<SeenMap>({});
  const [likes, setLikes] = useState<string[]>([]);
  const [kind, setKind] = useState<FeedSlot | "user" | null>(null);
  const [cardsReady, setCardsReady] = useState(0);
  const [summarizing, setSummarizing] = useState(false);
  const [, tickTime] = useState(0);
  useFocusEffect(useCallback(() => { const timer = setInterval(() => tickTime(value => value + 1), 60000); return () => clearInterval(timer); }, []));

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
  useAnimatedReaction(() => headerHeight.value > 0 ? hiddenHeader.value / headerHeight.value : 0, progress => {
    chromeHidden.value = progress;
  });
  function settleHeader(delay = 0) {
    "worklet";
    const hide = scrollY.value > 1 && (direction.value > 0 || direction.value === 0 && hiddenHeader.value > headerHeight.value / 2);
    const animation = withTiming(hide ? headerHeight.value : 0, { duration: 180 });
    hiddenHeader.value = delay ? withDelay(delay, animation) : animation;
  }
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: event => {
      cancelAnimation(hiddenHeader); dragging.value = true; momentum.value = false; direction.value = 0;
      scrollY.value = Math.max(0, event.contentOffset.y);
      layoutSize.value = { viewport: event.layoutMeasurement.height, content: event.contentSize.height };
    },
    onMomentumBegin: () => { cancelAnimation(hiddenHeader); momentum.value = true; },
    onScroll: event => {
      const next = Math.max(0, event.contentOffset.y);
      const size = { viewport: event.layoutMeasurement.height, content: event.contentSize.height };
      const resized = Math.abs(size.viewport - layoutSize.value.viewport) > 0.5 || Math.abs(size.content - layoutSize.value.content) > 0.5;
      layoutSize.value = size;
      // A finger drag remains authoritative even when a card changes its size.
      // Ignore layout-only offset changes outside an active drag.
      if (dragging.value || momentum.value && !resized) {
        const delta = next - scrollY.value;
        if (Math.abs(delta) > 0.5) direction.value = delta > 0 ? 1 : -1;
        hiddenHeader.value = next === 0 ? 0 : Math.max(0, Math.min(headerHeight.value, hiddenHeader.value + delta));
      }
      scrollY.value = next;
    },
    // A fling cancels this delayed snap; a drag without momentum still finishes.
    onEndDrag: () => { dragging.value = false; settleHeader(120); },
    onMomentumEnd: () => {
      momentum.value = false;
      // Android can deliver the interrupted fling's end after a new drag begins.
      // It must not stop or snap the header underneath the finger.
      if (!dragging.value) settleHeader();
    },
  });
  const headerMotion = useAnimatedStyle(() => ({ transform: [{ translateY: -hiddenHeader.value }] }));
  const bottomSpace = useAnimatedStyle(() => ({ paddingBottom: tabHeight.value + 28 }));
  useFocusEffect(useCallback(() => {
    cancelAnimation(hiddenHeader);
    chromeHidden.value = 0;
    hiddenHeader.value = 0;
    dragging.value = false;
    momentum.value = false;
  }, [chromeHidden, hiddenHeader, dragging, momentum]));
  const edge = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP),
  }));

  useEffect(() => subscribeFeedPosts(setPosts), []);
  useEffect(() => subscribeSeen(setSeen), []);
  useEffect(() => subscribeLikes(setLikes), []);
  useEffect(() => subscribeFeedTemplates(() => setCardsReady((value) => value + 1)), []);
  useEffect(() => subscribeFeedSummaryBusy(setSummarizing), []);
  useEffect(() => { void refreshUserPosts().then(() => setTimelineError(""), () => setTimelineError("用户动态暂时未能同步，下拉可重试")); }, []);

  const { pull, phase, gesture, scrollGesture } = usePullToRefresh({
    scrollY,
    onRefresh: async () => { setPosts(readFeedPosts()); try { await refreshUserPosts(); setTimelineError(""); } catch (error) { setTimelineError("用户动态暂时未能同步，下拉可重试"); Toast.show({ type: "error", text1: "刷新未完成", text2: error instanceof Error ? error.message : "请稍后重试" }); return false; } },
  });
  const refreshSpace = useAnimatedStyle(() => ({ height: pull.value }));

  const friends = useMemo(() => {
    const map = new Map<string, FeedFriend>();
    for (const bundle of bundles.filter(item => installedIds.includes(item.id))) {
      map.set(bundle.id, { id: bundle.id, name: bundle.title, mark: bundle.mark, accent: bundle.accent, Avatar: bundle.avatar });
    }
    return map;
  }, [installedIds, cardsReady]);

  /** 每位朋友最近一条动态的时间，用来判断有没有没看过的。 */
  const latest = useMemo(() => {
    const result: Record<string, number> = {};
    for (const post of posts) result[post.appId] = Math.max(result[post.appId] ?? 0, post.createdAt);
    return result;
  }, [posts]);

  const unread = useMemo(() => {
    const result = new Set<string>();
    for (const [appId, at] of Object.entries(latest)) if (at > (seen[appId] ?? 0)) result.add(appId);
    return result;
  }, [latest, seen]);

  /** 朋友栏：有新动态的排前面，其余按最近动态的先后。 */
  const rail = useMemo(() => {
    return [...friends.values()].sort((a, b) => {
      const gap = Number(unread.has(b.id)) - Number(unread.has(a.id));
      return gap || (latest[b.id] ?? 0) - (latest[a.id] ?? 0);
    });
  }, [friends, latest, unread]);

  const liked = useMemo(() => new Set(likes), [likes]);

  const kinds = useMemo(() => {
    const present = new Set(posts.map((post) => post.kind));
    return (Object.keys(KIND_LABEL) as FeedSlot[]).filter((item) => present.has(item));
  }, [posts]);

  const timeline = useMemo(() => [
    ...posts.map(post => ({ type: "app" as const, post })),
    ...userTimeline.posts.map(post => ({ type: "user" as const, post })),
  ].sort((a, b) => b.post.createdAt - a.post.createdAt || a.post.id.localeCompare(b.post.id)), [posts, userTimeline.posts]);
  const visible = useMemo(() => timeline.filter(item => !kind || (item.type === "user" ? kind === "user" : item.post.kind === kind)), [timeline, kind]);

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
    [latest, onOpen],
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <View style={styles.viewport} onLayout={event => setViewportSize(event.nativeEvent.layout.height)}>
        <Animated.View onLayout={event => { const height = event.nativeEvent.layout.height; headerHeight.value = height; setHeaderSize(height); }} style={[styles.floatingHeader, { paddingTop: insets.top }, headerMotion]}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.wordmark}>紫金花</Text>
              <Text style={styles.headerCaption} numberOfLines={1}>
                {summarizing ? "正在整理这段时间的动态" : todayLabel()}
              </Text>
            </View>
            <Pressy accessibilityRole="button" accessibilityLabel={`查看通知${unreadNotifications ? `，${unreadNotifications}条未读` : ""}`} onPress={onNotifications} hitSlop={4} style={{ padding: 6 }}><Bell size={21} color={colors.ink2} />{unreadNotifications > 0 ? <View style={{ position: "absolute", top: -2, right: -3, minWidth: 15, paddingHorizontal: 3, height: 15, borderRadius: 8, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 9, color: colors.accentText }}>{unreadNotifications > 99 ? "99+" : unreadNotifications}</Text></View> : null}</Pressy>
            <Pressy accessibilityRole="button" accessibilityLabel="发布文字和图片动态" onPress={onCompose} hitSlop={8} style={{ paddingHorizontal: 10, paddingVertical: 10 }}><Text style={{ color: colors.accentText, fontWeight: "600", fontSize: 14 }}>发动态</Text></Pressy>
            <Pressy accessibilityRole="button" accessibilityLabel="打开我的页面" onPress={onProfile} scale={0.92} hitSlop={8}>
              {user?.avatarUrl ? <FastImage source={{ uri: user.avatarUrl }} style={styles.profileAvatar} /> : <View style={[styles.profileAvatar, styles.profilePlaceholder]}><Text style={{ color: colors.accentText, fontWeight: "700" }}>{user ? Array.from(user.name)[0] : "我"}</Text></View>}
            </Pressy>
          </View>
          <Animated.View pointerEvents="none" style={[styles.headerEdge, edge]} />
        </View>
        <FriendRail friends={rail} unread={unread} onOpen={open} onNew={onNew} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          <Tab label="全部" active={kind === null} onPress={() => setKind(null)} />
          <Tab label="用户" active={kind === "user"} onPress={() => setKind("user")} />
          {kinds.map(item => <Tab key={item} label={KIND_LABEL[item]} active={kind === item} onPress={() => setKind(item)} />)}
        </ScrollView>
        </Animated.View>

        <GestureDetector gesture={gesture}>
          <View style={styles.pullHost}>
            <View style={styles.scroll}>
              <GestureDetector gesture={scrollGesture}>
                <Animated.FlatList ref={list} data={visible} keyExtractor={item => `${item.type}-${item.post.id}`} initialNumToRender={8} maxToRenderPerBatch={6} windowSize={7} removeClippedSubviews={false}
                  style={styles.scroll}
                  contentContainerStyle={[styles.content, bottomSpace, { minHeight: viewportSize + headerSize }]}
                  showsVerticalScrollIndicator={false}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  overScrollMode="never"
                  bounces={false}
                  scrollEnabled={phase !== "refreshing" && phase !== "done"}
                  ListHeaderComponent={<View>
                  <View style={{ height: headerSize }} />
                  <Animated.View style={refreshSpace}><PullIndicator pull={pull} phase={phase} /></Animated.View>
                  {timelineError ? <Text style={{ color: colors.ink3, padding: 16, fontSize: 12 }}>{timelineError}</Text> : null}

                  </View>}
                  ListEmptyComponent={<View style={styles.empty}><DefaultAvatar size={64} /><Text style={styles.emptyTitle}>{kind === "user" ? "还没有用户动态" : "这里还很安静"}</Text><Text style={styles.emptyBody}>分享一个想法，或换个分类看看。</Text></View>}
                  renderItem={({ item }) => {
                    if (item.type === "user") {
                      const post = user && item.post.author.id === user.id ? { ...item.post, author: { id: user.id, name: user.name, avatarUrl: user.avatarUrl } } : item.post;
                      return <View style={styles.post}><UserPostCard post={post} time={formatWhen(post.createdAt)} own={user?.id === post.author.id} onOpen={() => onPost(post)} onApplication={onApplication} onAuthor={onAuthor} /></View>;
                    }
                    const post = item.post;
                    const friend = friends.get(post.appId) ?? { id: post.appId, name: post.appId, mark: "友", accent: colors.accent };
                    const Template = cardsReady >= 0 && post.kind !== "summary" ? peekFeedTemplate(post.appId, post.kind as FeedKind) : undefined;
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
                  }}
                  ListFooterComponent={<View>
                  {(!kind || kind === "user") && userTimeline.nextCursor ? <Pressable disabled={loadingMore} onPress={() => { setLoadingMore(true); void loadMoreUserPosts().catch(error => Toast.show({ type: "error", text1: "加载失败", text2: error.message })).finally(() => setLoadingMore(false)); }} style={{ alignItems: "center", padding: 16 }}><Text style={{ color: colors.accentText }}>{loadingMore ? "正在加载…" : "加载更多用户动态"}</Text></Pressable> : null}
                  {visible.length > 0 && (!userTimeline.nextCursor || (kind && kind !== "user")) ? (
                    <View style={styles.end}>
                      <Icon name="workshop" size={16} color={colors.accentText} />
                      <Text style={styles.endText}>已浏览全部动态</Text>
                    </View>
                  ) : null}
                  </View>}
                />
              </GestureDetector>
            </View>
          </View>
        </GestureDetector>
        </View>
      </View>
    </GestureHandlerRootView>
  );
});

/** 时间线顶上的分类标签，像 X 的「为你推荐 / 正在关注」：选中的那一项字加粗，底下一道金色的线。 */
function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.tab, pressed && { backgroundColor: colors.inset }]}
    >
      <View style={styles.tabInner}>
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
        <View style={[styles.tabBar, active && { backgroundColor: colors.accent }]} />
      </View>
    </Pressable>
  );
}

function todayLabel(): string {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日 周${WEEKDAYS[now.getDay()]}`;
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

const styles = themedStyleSheet((t) => ({
  container: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  floatingHeader: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: t.canvas },
  viewport: { flex: 1, overflow: "hidden" },
  profileAvatar: { width: 34, height: 34, borderRadius: 17 },
  profilePlaceholder: { backgroundColor: t.accentTint, alignItems: "center", justifyContent: "center" },
  header: {
    backgroundColor: t.canvas,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 2,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  wordmark: {
    fontFamily: t.serif,
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "700",
    color: t.ink1,
    letterSpacing: 1,
  },
  headerCaption: {
    fontSize: 11.5,
    lineHeight: 15,
    color: t.ink3,
  },
  headerEdge: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: t.lineStrong,
  },
  scroll: {
    flex: 1,
  },
  pullHost: {
    flex: 1,
    overflow: "hidden",
  },
  content: {
    paddingTop: 4,
    paddingBottom: 12,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: t.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: t.line,
  },
  tab: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: 44,
  },
  tabText: {
    flex: 1,
    textAlignVertical: "center",
    fontSize: 13.5,
    fontWeight: "500",
    color: t.ink3,
  },
  tabTextActive: {
    color: t.ink1,
    fontWeight: "700",
  },
  tabBar: {
    width: 24,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: "transparent",
  },
  post: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.line,
  },
  empty: {
    alignItems: "center",
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyTitle: {
    marginTop: 6,
    fontFamily: t.serif,
    fontSize: 18,
    fontWeight: "700",
    color: t.ink1,
  },
  emptyBody: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    color: t.ink3,
  },
  end: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 12,
  },
  endText: {
    fontSize: 11.5,
    color: t.ink3,
  },
}));
