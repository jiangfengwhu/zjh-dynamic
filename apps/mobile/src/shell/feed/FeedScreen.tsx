import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  Extrapolation,
  FadeInDown,
  LinearTransition,
  cancelAnimation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
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
import { JollyCompanion } from "../../../../../packages/ui/jolly";
import { useCompanionName } from "../../../../../packages/ui/jolly/name";
import type { AppEntry } from "../catalog";
import { themedStyleSheet, useTheme } from "../../../../../packages/ui/theme";
import { Screen, ScreenBar } from "../../../../../packages/ui/edge";
import { subscribeFeedSummaryBusy } from "./summary";
import { FriendRail } from "./FriendRail";
import { CardSlot } from "./CardSlot";
import { PullIndicator } from "./PullIndicator";
import { usePullToRefresh } from "./pullToRefresh";
import { subscribeLikes, toggleLike } from "./likes";
import { markSeen, subscribeSeen, type SeenMap } from "./seen";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 页面打开时，前几条依次落位，这是整页唯一的进场动效。 */
const REVEAL_COUNT = 5;

type FeedProps = {
  apps: AppEntry[];
  onLibrary: () => void;
  onOpen: (id: string) => void;
  /** 对某位朋友说一句：带着 TA 的名字去工坊。 */
  onReply: (id: string) => void;
  /** 找新朋友：去工坊许一个新心愿。 */
  onNew: () => void;
};

export const FeedScreen = memo(function FeedScreen({ apps, onLibrary, onOpen, onReply, onNew }: FeedProps) {
  const { colors } = useTheme();
  const companionName = useCompanionName();
  const [posts, setPosts] = useState<FeedPost[]>(() => readFeedPosts());
  const [seen, setSeen] = useState<SeenMap>({});
  const [likes, setLikes] = useState<string[]>([]);
  const [kind, setKind] = useState<FeedSlot | null>(null);
  const [cardsReady, setCardsReady] = useState(0);
  const [summarizing, setSummarizing] = useState(false);
  const firstIds = useRef<Set<string>>(new Set(posts.slice(0, REVEAL_COUNT).map((post) => post.id)));
  const knownIds = useRef<Set<string>>(new Set(posts.map((post) => post.id)));

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const edge = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP),
  }));

  // 进场动效只在页面第一次出现时跑一遍，之后切换分类不再重播
  useEffect(() => {
    const timer = setTimeout(() => {
      firstIds.current = new Set();
    }, 1600);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => subscribeFeedPosts(setPosts), []);
  useEffect(() => subscribeSeen(setSeen), []);
  useEffect(() => subscribeLikes(setLikes), []);
  useEffect(() => subscribeFeedTemplates(() => setCardsReady((value) => value + 1)), []);
  useEffect(() => subscribeFeedSummaryBusy(setSummarizing), []);

  const { pull, phase, gesture, scrollGesture } = usePullToRefresh({
    scrollY,
    onRefresh: () => setPosts(readFeedPosts()),
  });
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: pull.value }] }));

  const friends = useMemo(() => {
    const map = new Map<string, FeedFriend>();
    for (const app of apps) {
      const bundle = bundles.find((item) => item.id === app.id);
      if (!bundle) continue;
      map.set(bundle.id, { id: bundle.id, name: bundle.id === "jolly" ? companionName : app.title, mark: bundle.mark, accent: bundle.accent, Avatar: bundle.avatar });
    }
    return map;
  }, [apps, companionName]);

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

  const visible = useMemo(() => (kind ? posts.filter((post) => post.kind === kind) : posts), [posts, kind]);

  useEffect(() => {
    if (kind && !kinds.includes(kind)) setKind(null);
  }, [kind, kinds]);

  // 记下已经出现过的帖子，之后新来的才走落位动效
  const freshIds = new Set<string>();
  for (const post of visible) if (!knownIds.current.has(post.id)) freshIds.add(post.id);
  useEffect(() => {
    for (const post of posts) knownIds.current.add(post.id);
  }, [posts]);

  const open = useCallback(
    (appId: string) => {
      markSeen(appId, latest[appId] ?? Date.now());
      onOpen(appId);
    },
    [latest, onOpen],
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <Screen style={styles.container}>
        <ScreenBar style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.wordmark}>紫金花</Text>
              <Text style={styles.headerCaption} numberOfLines={1}>
                {summarizing ? "正在整理这段时间的动态" : todayLabel()}
              </Text>
            </View>
            <Pressy accessibilityRole="button" onPress={onLibrary} style={styles.libraryButton}>
              <Icon name="box" size={17} color={colors.orchidText} />
              <Text style={styles.libraryLabel}>我的应用</Text>
            </Pressy>
            <Pressy accessibilityRole="button" accessibilityLabel={`打开${companionName}`} onPress={() => open("jolly")} scale={0.92} hitSlop={8}>
              <Halo active={summarizing} size={30}>
                <JollyCompanion size="avatar" state={summarizing ? "making" : "idle"} showBubble={false} />
              </Halo>
            </Pressy>
          </View>
          <Animated.View pointerEvents="none" style={[styles.headerEdge, edge]} />
        </ScreenBar>

        <GestureDetector gesture={gesture}>
          <View style={styles.pullHost}>
            <PullIndicator pull={pull} phase={phase} />
            <Animated.View style={[styles.scroll, lift]}>
              <GestureDetector gesture={scrollGesture}>
                <Animated.ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.content}
                  showsVerticalScrollIndicator={false}
                  onScroll={onScroll}
                  scrollEventThrottle={16}
                  overScrollMode="never"
                  bounces={false}
                  scrollEnabled={phase !== "refreshing" && phase !== "done"}
                  stickyHeaderIndices={kinds.length > 1 ? [1] : undefined}
                >
                  <FriendRail friends={rail} unread={unread} onOpen={open} onNew={onNew} />

                  {kinds.length > 1 ? (
                    // 吸顶的那一层会把子节点的样式换成 flex: 1，所以外面多包一层，真正的样式放在里面
                    <View>
                      <View style={styles.tabs}>
                        <Tab label="全部" active={kind === null} onPress={() => setKind(null)} />
                        {kinds.map((item) => (
                          <Tab key={item} label={KIND_LABEL[item]} active={kind === item} onPress={() => setKind(kind === item ? null : item)} />
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {visible.length === 0 ? (
                    <View style={styles.empty}>
                      <JollyCompanion size="md" state="idle" showBubble={false} />
                      <Text style={styles.emptyTitle}>{kind ? `还没有${KIND_LABEL[kind]}` : "这里还很安静"}</Text>
                      <Text style={styles.emptyBody}>
                        {kind ? "换一个分类，或者回到全部看看。" : "朋友们有了新动态，会在这里跟你说。"}
                      </Text>
                      {!kind ? <Pressy accessibilityRole="button" onPress={onNew} style={styles.libraryButton}><Text style={styles.libraryLabel}>去工坊做个应用</Text></Pressy> : null}
                    </View>
                  ) : null}

                  {visible.map((post, index) => {
                    const friend = friends.get(post.appId) ?? { id: post.appId, name: post.appId, mark: "友", accent: colors.accent };
                    const Template = cardsReady >= 0 && post.kind !== "summary" ? peekFeedTemplate(post.appId, post.kind as FeedKind) : undefined;
                    const enter = firstIds.current.has(post.id)
                      ? FadeInDown.delay(index * 70).duration(520).easing(Easing.out(Easing.cubic))
                      : freshIds.has(post.id)
                        ? FadeInDown.duration(420).easing(Easing.out(Easing.cubic))
                        : undefined;
                    return (
                      <Fragment key={post.id}>
                        <Animated.View entering={enter} layout={LinearTransition.duration(260)} style={styles.post}>
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
                        </Animated.View>
                      </Fragment>
                    );
                  })}

                  {visible.length > 0 ? (
                    <View style={styles.end}>
                      <Icon name="workshop" size={16} color={colors.accentText} />
                      <Text style={styles.endText}>已经看到最新</Text>
                    </View>
                  ) : null}
                </Animated.ScrollView>
              </GestureDetector>
            </Animated.View>
          </View>
        </GestureDetector>
      </Screen>
    </GestureHandlerRootView>
  );
});

/** 头像外一圈金环。整理动态时缓慢呼吸，平时只留一圈淡淡的底光。 */
function Halo({ active, size, children }: { active: boolean; size: number; children: ReactNode }) {
  const { colors } = useTheme();
  const glow = useSharedValue(0.32);
  useEffect(() => {
    cancelAnimation(glow);
    if (active) {
      const ease = Easing.inOut(Easing.quad);
      glow.value = withRepeat(
        withSequence(withTiming(1, { duration: 900, easing: ease }), withTiming(0.2, { duration: 900, easing: ease })),
        -1,
        false,
      );
    } else {
      glow.value = withTiming(0.32, { duration: 300 });
    }
  }, [active, glow]);
  const ring = useAnimatedStyle(() => ({ opacity: glow.value }));
  const outer = size + 8;
  return (
    <View style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            borderWidth: 1.5,
            borderColor: colors.accent,
          },
          ring,
        ]}
      />
      {children}
    </View>
  );
}

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
  libraryButton: { minHeight: 44, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, backgroundColor: t.orchidTint },
  libraryLabel: { fontSize: 13, fontWeight: "600", color: t.orchidText },
  container: {
    flex: 1,
    backgroundColor: t.canvas,
  },
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
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "700",
    color: t.ink1,
    letterSpacing: 1,
  },
  headerCaption: {
    fontSize: 12.5,
    lineHeight: 18,
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
    paddingBottom: 28,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: t.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: t.line,
  },
  tab: {
    flex: 1,
    alignItems: "center",
  },
  tabInner: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: 36,
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
    paddingTop: 48,
    paddingHorizontal: 28,
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
    paddingTop: 16,
  },
  endText: {
    fontSize: 11.5,
    color: t.ink3,
  },
}));
