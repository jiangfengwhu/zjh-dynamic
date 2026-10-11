import { useEventCallback } from "../useEventCallback";
import { appendUnique } from "../listData";
import { AnimatedFlashList, type FlashListRef } from "../AnimatedFlashList";
import { ListGesture } from "./ListGesture";
import { afterInteractions, waitForRouteTransitions } from "../interactionWork";
import { lazyScreen } from "../lazyScreen";
import { useVisitedPager } from "../useVisitedPager";
import { Text } from "../../../../../packages/ui/primitives/Typography";
import { reconnectMessages } from "../social/api";
import { dispatchLiveEvent, useLiveVersion } from "../liveEvents";
import { UserAvatar } from "../UserAvatar";
const InboxContent = lazyScreen(() => (require("../social/InboxContent") as typeof import("../social/InboxContent")).InboxContent);
import { useMessageCount } from "../social/api";
import type { PublicAuthor } from "./userPosts";
import { JollyPortrait } from "../jolly/ui/portrait";
import { EmptyState } from "../EmptyState";
import { cachedPage, rememberPage, pageCacheKey } from "../pageCache";
import { ActivityIndicator, AppState, type ViewToken } from "react-native";
import { PageSkeleton } from "../LoadingSkeleton";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  runOnUI,
  runOnJS,
  useEvent,
  type SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { Pressy, RoundButton } from "../../../../../packages/ui/chrome";
import { Screen, ScreenBar } from "../../../../../packages/ui/edge";
import { ThemeContext, useTheme } from "../../../../../packages/ui/theme";
import { currentAccountId, requireAccount, useAccount } from "../account";

import {
  markNotificationsRead,
  readNotifications,
  noticeHeading,
  useNotificationCount,
  useNotificationCategoryCounts,
  type Notice,
  type NoticePage,
  type NoticeCategory,
} from "./notifications";

import { PullIndicator } from "./PullIndicator";
import { usePullToRefresh } from "./pullToRefresh";
import { formatWhen } from "../formatTime";

import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { CompactTabs } from "../CompactTabs";
import { SymbolIcon } from "../../../../../packages/ui/chrome/SymbolIcon";
const AnimatedPager = Animated.createAnimatedComponent(PagerView);
type Props = {
  drawerGesture?: ReturnType<typeof Gesture.Pan>;
  drawerPaging?: {
    active: SharedValue<boolean>;
    position: SharedValue<number>;
  };
  onBack?: () => void;
  onOpen: (notice: Notice) => Promise<boolean>;
  onMessage: (peer: PublicAuthor) => void;
};
export function NotificationsScreen(props: Props) {
  const theme = useTheme();
  return (
    <ThemeContext.Provider value={theme}>
      <NotificationsPage {...props} />
    </ThemeContext.Provider>
  );
}
function NotificationsPage(props: Props) {
  const { colors } = useTheme();
  const { visited, visit, reveal } = useVisitedPager();
  const [category, setCategory] = useState<NoticeCategory | "messages">("creation");
  const [marking, setMarking] = useState(false);
  const count = useNotificationCount();
  const counts = useNotificationCategoryCounts();
  const messageCount = useMessageCount();
  const tabLabel = (label: string, unread: number) => unread ? `${label} (${unread > 99 ? "99+" : unread})` : label;
  const pager = useRef<PagerView>(null);
  const localPosition = useSharedValue(0);
  const position = props.drawerPaging?.position || localPosition;
  const drawerActive = props.drawerPaging?.active;
  useFocusEffect(
    useCallback(() => {
      if (!drawerActive) return;
      runOnUI(() => {
        "worklet";
        drawerActive.value = true;
      })();
      return () => {
        runOnUI(() => {
          "worklet";
          drawerActive.value = false;
        })();
      };
    }, [drawerActive])
  );
  const native = useMemo(
    () =>
      props.drawerGesture
        ? Gesture.Native().requireExternalGestureToFail(props.drawerGesture)
        : Gesture.Native(),
    [props.drawerGesture]
  );
  const onPageScroll = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      "worklet";
      reveal(event.position, event.offset);
      position.value = event.position + event.offset;
    },
    ["onPageScroll"]
  );
  const onPageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    (event) => {
      "worklet";
      runOnJS(visit)(event.position);
      runOnJS(setCategory)(event.position === 0 ? "creation" : event.position === 1 ? "interaction" : "messages");
    },
    ["onPageSelected"]
  );
  async function markAll() {
    if (marking) return;
    setMarking(true);
    try {
      await markNotificationsRead();
      dispatchLiveEvent({ type: "notification" });
    } catch (cause) {
      Toast.show({
        type: "error",
        text1: "标记未完成",
        text2: cause instanceof Error ? cause.message : "请重试",
      });
    } finally {
      setMarking(false);
    }
  }
  return (
    <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenBar style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 40 }}>
          {props.onBack ? <RoundButton icon="back" label="返回" onPress={props.onBack} /> : null}
          <Text accessibilityRole="header" style={{ flex: 1, ...colors.type.display, color: colors.ink1 }}>通知</Text>
          {category !== "messages" ? <Pressy accessibilityLabel="将所有通知标记为已读" disabled={marking || !count} onPress={() => void markAll()} scale={0.9} hitSlop={6} style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center", backgroundColor: count ? colors.accent : colors.surfaceRaised, borderRadius: 18, paddingHorizontal: 0, paddingVertical: 0 }}>{marking ? <ActivityIndicator size="small" color={count ? colors.onAccent : colors.ink3} /> : <SymbolIcon name="check" size={17} strokeWidth={2.4} color={count ? colors.onAccent : colors.ink3} />}</Pressy> : null}
        </View>
        <CompactTabs value={category} position={position} options={[{ id: "creation", label: tabLabel("制作", counts.creation) }, { id: "interaction", label: tabLabel("互动", counts.interaction) }, { id: "messages", label: tabLabel("私信", messageCount) }]} onChange={value => pager.current?.setPage(value === "creation" ? 0 : value === "interaction" ? 1 : 2)} />
      </ScreenBar>
      <GestureDetector gesture={native}>
        <AnimatedPager
          ref={pager}
          style={{ flex: 1 }}
          offscreenPageLimit={1}
          overScrollMode="never"
          onPageScroll={onPageScroll}
          onPageSelected={onPageSelected}
        >
          <View key="creation" collapsable={false} style={{ flex: 1 }}>
            {visited.has(0) ? (<NotificationsContent
              {...props}
              category="creation"
              active={category === "creation"}
            />) : null}
          </View>
          <View key="interaction" collapsable={false} style={{ flex: 1 }}>
            {visited.has(1) ? (<NotificationsContent
              {...props}
              category="interaction"
              active={category === "interaction"}
            />) : null}
          </View>
          <View key="messages" collapsable={false} style={{ flex: 1 }}>
            {visited.has(2) ? (<InboxContent active={category === "messages"} onMessage={props.onMessage} drawerGesture={props.drawerGesture} />) : null}
          </View>
        </AnimatedPager>
      </GestureDetector>
    </Screen>
  );
}
function NotificationsContent({
  onOpen,
  drawerGesture,
  category,
  active,
}: Props & { category: NoticeCategory; active: boolean }) {
  const { colors } = useTheme();
  const { user } = useAccount();
  const focused = useIsFocused() && active;
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const visible = useRef(new Set<string>());
  const seen = useRef(new Set<string>());
  const readFlight = useRef(false);
  const readTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const readVisible = useRef<() => void>(() => {});
  const viewabilityConfig = useRef({ minimumViewTime: 600, itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Notice>[] }) => {
    visible.current = new Set(viewableItems.filter(item => item.isViewable).map(item => item.item.id));
    readVisible.current();
  }).current;
  const cacheKey = pageCacheKey(`notices:${category}`);
  const [page, setPage] = useState<NoticePage>(() => cachedPage<NoticePage>(cacheKey) ?? { notices: [], nextCursor: null, unreadCount: 0 });
  const pageRef = useRef(page); pageRef.current = page;
  const [loading, setLoading] = useState(Boolean(user));
  const [loaded, setLoaded] = useState(() => !!cachedPage(cacheKey));
  const [loadingMore, setLoadingMore] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const acting = actingId !== null;
  const [error, setError] = useState("");
  const alive = useRef(true);
  const revision = useRef(0);
  const reading = useRef(false);
  const writing = useRef(false);
  const noticeVersion = useLiveVersion("notification");
  const reload = useRef<() => Promise<void | boolean>>(async () => {});
  const again = useRef(false);
  reload.current = () => load(false);
  const list = useRef<FlashListRef<Notice>>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const { pull, phase, gesture } = usePullToRefresh({
    scrollY,
    onRefresh: () => { reconnectMessages(); return load(); },
  });
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }));
  const scrollGesture = useMemo(
    () =>
      drawerGesture
        ? Gesture.Native().requireExternalGestureToFail(gesture, drawerGesture)
        : Gesture.Native().requireExternalGestureToFail(gesture),
    [drawerGesture, gesture]
  );
  readVisible.current = () => {
    if (!focused || !foreground || !user || readFlight.current || readTimer.current !== undefined) return;
    const owner = user.id;
    const before = revision.current;
    readTimer.current = setTimeout(() => {
      readTimer.current = undefined;
      if (!alive.current || before !== revision.current) return;
      const ids = pageRef.current.notices.filter(item => !item.read && !seen.current.has(item.id) && visible.current.has(item.id)).map(item => item.id).slice(0, 100);
      if (!ids.length) return;
      readFlight.current = true;
      void markNotificationsRead(ids).then(async result => {
        if (!alive.current || before !== revision.current || await currentAccountId() !== owner) return;
        ids.forEach(id => seen.current.add(id));
        setPage(previous => {
          const next = { ...previous, unreadCount: result.unreadCount, unreadByCategory: result.unreadByCategory,
            notices: previous.notices.map(item => seen.current.has(item.id) ? { ...item, read: true } : item) };
          return rememberPage(cacheKey, next);
        });
      }).then(() => { readFlight.current = false; readVisible.current(); }, () => { readFlight.current = false; });
    }, 200);
  };
  async function load(more = false) {
    if (!user || (more && !page.nextCursor)) return false;
    if (reading.current) {
      if (!more) again.current = true;
      return false;
    }
    reading.current = true;
    setLoading(true);
    setLoadingMore(more);
    const before = revision.current;
    const owner = user.id;
    try {
      const result = await readNotifications(
        more ? page.nextCursor! : undefined,
        category
      );
      await waitForRouteTransitions();
      if (
        !alive.current ||
        before !== revision.current ||
        (await currentAccountId()) !== owner
      )
        return false;
      setLoaded(true);
      setPage((previous) => {
        const next = more
          ? {
              ...result,
              notices: appendUnique(previous.notices, result.notices, item => item.id),
            }
          : result;
        next.notices = next.notices.map(item => seen.current.has(item.id) ? { ...item, read: true } : item);
        return rememberPage(cacheKey, next);
      });
      setError("");
      return true;
    } catch (cause) {
      if (alive.current && before === revision.current)
        setError(cause instanceof Error ? cause.message : "通知暂时无法加载");
      return false;
    } finally {
      reading.current = false;
      if (alive.current) {
        setLoading(false);
        setLoadingMore(false);
        if (again.current) {
          again.current = false;
          void reload.current();
        }
      }
    }
  }
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (focused && foreground) readVisible.current();
    return () => { if (readTimer.current !== undefined) clearTimeout(readTimer.current); readTimer.current = undefined; };
  }, [focused, foreground, page]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    revision.current++;
    seen.current.clear();
    visible.current.clear();
    const cached = cachedPage<NoticePage>(cacheKey);
    setPage(cached ?? { notices: [], nextCursor: null, unreadCount: 0 });
    setLoading(Boolean(user));
    setLoaded(!!cached);
    setLoadingMore(false);
    setError("");
  }, [user?.id]);
  useEffect(() => {
    if (!user || !foreground) return;
    const cancel = afterInteractions(() => { void load(false); });
    return cancel;
  }, [focused, foreground, user?.id, noticeVersion]);
  async function act(notice: Notice) {
    if (writing.current || !user) return;
    writing.current = true;
    setActingId(notice.id);
    try {
      await onOpen(notice);
    } catch (cause) {
      if (alive.current)
        Toast.show({
          type: "error",
          text1: "通知操作未完成",
          text2: cause instanceof Error ? cause.message : "请稍后重试",
        });
    } finally {
      writing.current = false;
      if (alive.current) {
        setActingId(null);
        if (reading.current) again.current = true;
        else if (!page.notices.length) void reload.current();
      }
    }
  }
  const actNotice = useEventCallback(act);
  return (
    <View style={{ flex: 1 }}>
      <GestureDetector gesture={gesture}>
        <View style={{ flex: 1, overflow: "hidden" }}>
          <PullIndicator pull={pull} phase={phase} />
          <Animated.View style={[{ flex: 1 }, lift]}>
            <ListGesture gesture={scrollGesture}>
              <AnimatedFlashList<Notice> maintainVisibleContentPosition={{ disabled: true }}
                ref={list}
                data={user ? page.notices : []}
                contentContainerStyle={!user || !page.notices.length ? { flexGrow: 1 } : undefined}
                keyExtractor={(item) => item.id}
                viewabilityConfig={viewabilityConfig}
                onViewableItemsChanged={onViewableItemsChanged}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                bounces={false}
                overScrollMode="never"
                scrollEnabled={phase !== "refreshing" && phase !== "done"}
                ListHeaderComponent={
                  error ? (
                    <Pressable
                      onPress={() => void load()}
                      style={{ padding: 16 }}
                    >
                      <Text style={{ color: colors.danger }}>
                        {error} · 点击重试
                      </Text>
                    </Pressable>
                  ) : null
                }
                renderItem={({ item }) => <NoticeRow item={item} acting={actingId === item.id} act={actNotice} />}
                ListEmptyComponent={
                  <EmptyState style={user && loading && !loaded ? { flexGrow: 0, alignItems: "stretch", padding: 16 } : undefined}>
                    {user && loading && !loaded ? (
                      <PageSkeleton rows={4} shape="notification" />
                    ) : (
                      <Text style={{ color: colors.ink3, textAlign: "center", fontSize: 14, lineHeight: 20 }}>
                        {user
                          ? category === "creation"
                            ? "制作完成或失败，会在这里通知你"
                            : "点赞、评论和回复会出现在这里"
                          : "请登录后查看通知"}
                      </Text>
                    )}
                    {!user ? (
                      <Pressy
                        accessibilityRole="button"
                        accessibilityLabel="登录查看通知"
                        onPress={() => {
                          void requireAccount();
                        }}
                        style={{ minHeight: 40, paddingHorizontal: 20, borderRadius: 20, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}
                      >
                        <Text style={{ color: colors.onAccent, fontWeight: "700" }}>
                          登录查看通知
                        </Text>
                      </Pressy>
                    ) : null}
                  </EmptyState>
                }
                ListFooterComponent={
                  page.nextCursor ? (
                    <Pressable
                      disabled={loading || acting}
                      onPress={() => void load(true)}
                      style={{ padding: 16 }}
                    >
                      {loadingMore ? (
                        <ActivityIndicator color={colors.ink2} />
                      ) : (
                        <Text
                          style={{
                            color: colors.ink2,
                            fontWeight: "600",
                            textAlign: "center",
                          }}
                        >
                          加载更多通知
                        </Text>
                      )}
                    </Pressable>
                  ) : null
                }
              />
            </ListGesture>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const NoticeRow = memo(function NoticeRow({ item, acting, act }: { item: Notice; acting: boolean; act: (item: Notice) => Promise<void> }) {
  const { colors } = useTheme();
  return (
                  <Pressy
                    disabled={acting}
                    accessibilityLabel={`${noticeHeading(item)}${
                      item.read ? "" : "，未读"
                    }`}
                    onPress={() => void act(item)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderRadius: 0,
                      flexDirection: "row",
                      gap: 10,
                      borderBottomWidth: colors.components.surfaceBorder,
                      borderBottomColor: colors.line,
                      backgroundColor: item.read
                        ? "transparent"
                        : colors.accentTint,
                    }}
                  >
                    {item.kind.startsWith("work-") ? (
                      <JollyPortrait size={36} />
                    ) : (
                      <UserAvatar uri={item.actor.avatarUrl} authorId={item.actor.id} size={36} />
                    )}
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text numberOfLines={2} style={{ flex: 1, color: colors.ink1, fontSize: 14, lineHeight: 20, letterSpacing: -0.1, fontWeight: item.read ? "600" : "700" }}>
                          {noticeHeading(item)}
                        </Text>
                        <Text style={{ color: colors.ink3, fontSize: 11 }}>
                          {formatWhen(item.createdAt)}
                        </Text>
                      </View>
                      <Text
                        numberOfLines={2}
                        style={{
                          color: colors.ink2,
                          fontSize: 13,
                          lineHeight: 19,
                        }}
                      >
                        {item.body}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.ink3, fontSize: 12, lineHeight: 17 }}
                      >
                        {item.postPreview}
                      </Text>
                    </View>
                    {!item.read ? (
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: colors.orchid,
                          marginTop: 6,
                        }}
                      />
                    ) : null}
                  </Pressy>
  );
});
