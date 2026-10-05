import { UserAvatar } from "../UserAvatar";
import { EmptyState } from "../EmptyState";
import { cachedPage, rememberPage, pageCacheKey, dataChanged } from "../pageCache";
import { NewDataNotice } from "../NewDataNotice";
import { ActivityIndicator, FlatList } from "react-native";
import { PageSkeleton, LoadingSkeleton } from "../LoadingSkeleton";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { Pressable, Text, View } from "react-native";
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
import Toast from "react-native-toast-message";
import { Pressy } from "../../../../../packages/ui/chrome";
import { Screen, ScreenBar } from "../../../../../packages/ui/edge";
import { ThemeContext, useTheme } from "../../../../../packages/ui/theme";
import { currentAccountId, requireAccount, useAccount } from "../account";
import { readShellValue, writeShellValue } from "../shellStorage";
import {
  markNotificationsRead,
  readNotifications,
  noticeHeading,
  useNotificationCount,
  type Notice,
  type NoticePage,
  type NoticeCategory,
} from "./notifications";
import { usePixelTheme } from "./pixelTheme";
import { PullIndicator } from "./PullIndicator";
import { usePullToRefresh } from "./pullToRefresh";

import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import { CompactTabs } from "../CompactTabs";
import { PixelIcon } from "./PixelKit";
const AnimatedPager = Animated.createAnimatedComponent(PagerView);
type Props = {
  drawerGesture?: ReturnType<typeof Gesture.Pan>;
  drawerPaging?: {
    active: SharedValue<boolean>;
    position: SharedValue<number>;
  };
  onBack?: () => void;
  onOpen: (notice: Notice) => Promise<boolean>;
};
export function NotificationsScreen(props: Props) {
  const theme = usePixelTheme();
  return (
    <ThemeContext.Provider value={theme}>
      <NotificationsPage {...props} />
    </ThemeContext.Provider>
  );
}
function NotificationsPage(props: Props) {
  const { colors } = useTheme();
  const [category, setCategory] = useState<NoticeCategory>("creation");
  const [marking, setMarking] = useState(false);
  const count = useNotificationCount();
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
      position.value = event.position + event.offset;
    },
    ["onPageScroll"]
  );
  const onPageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    (event) => {
      "worklet";
      runOnJS(setCategory)(event.position === 0 ? "creation" : "interaction");
    },
    ["onPageSelected"]
  );
  async function markAll() {
    if (marking) return;
    setMarking(true);
    try {
      await markNotificationsRead();
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
      <ScreenBar
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 4,
          gap: 0,
        }}
      >
        <View style={{ width: 56, height: 44, justifyContent: "center" }}>
          {props.onBack ? (
            <Pressy
              accessibilityLabel="返回"
              onPress={props.onBack}
              style={{ width: 44, height: 44, justifyContent: "center" }}
            >
              <PixelIcon name="back" size={20} color={colors.ink1} />
            </Pressy>
          ) : (
            <Text
              accessibilityRole="header"
              style={{ color: colors.ink1, fontSize: 18 }}
            >
              通知
            </Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, alignItems: "center" }}>
          <View style={{ width: 224, maxWidth: "100%" }}>
            <CompactTabs
              value={category}
              position={position}
              tone="mint"
              options={[
                { id: "creation", label: "制作" },
                { id: "interaction", label: "互动" },
              ]}
              onChange={(value) =>
                pager.current?.setPage(value === "creation" ? 0 : 1)
              }
            />
          </View>
        </View>
        <View style={{ width: 56, alignItems: "flex-end" }}>
          <Pressy
            accessibilityLabel="将所有通知标记为已读"
            disabled={marking || !count}
            onPress={() => void markAll()}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {marking ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <PixelIcon
                name="check"
                size={20}
                color={count ? colors.accentText : colors.ink3}
              />
            )}
          </Pressy>
        </View>
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
            <NotificationsContent
              {...props}
              category="creation"
              active={category === "creation"}
            />
          </View>
          <View key="interaction" collapsable={false} style={{ flex: 1 }}>
            <NotificationsContent
              {...props}
              category="interaction"
              active={category === "interaction"}
            />
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
  const count = useNotificationCount();
  const focused = useIsFocused() && active;
  const seenCount = useRef(count);
  const cacheKey = pageCacheKey(`notices:${category}`);
  const [page, setPage] = useState<NoticePage>(() => cachedPage<NoticePage>(cacheKey) ?? { notices: [], nextCursor: null, unreadCount: 0 });
  const [pendingPage, setPendingPage] = useState<NoticePage>();
  const [loading, setLoading] = useState(Boolean(user));
  const [loaded, setLoaded] = useState(() => !!cachedPage(cacheKey));
  const [loadingMore, setLoadingMore] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const revision = useRef(0);
  const reading = useRef(false);
  const writing = useRef(false);
  const firstCursor = useRef<string | null>(null);
  const loadedOwner = useRef<string | undefined>(undefined);
  const reload = useRef<() => Promise<void | boolean>>(async () => {});
  const again = useRef(false);
  reload.current = () => load(false, false);
  const list = useRef<FlatList<Notice>>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const { pull, phase, gesture } = usePullToRefresh({
    scrollY,
    onRefresh: () => load(),
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
  function remember(next: NoticePage) {
    rememberPage(cacheKey, next);
    setPage(next);
  }
  async function load(more = false, manual = true) {
    if (!user || writing.current || (more && !page.nextCursor)) return false;
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
      if (!more && loadedOwner.current !== owner) {
        loadedOwner.current = owner;
        const raw = await readShellValue(
          `social.notifications.${owner}.${category}`
        );
        if (raw && alive.current && before === revision.current) {
          try {
            const cached = JSON.parse(raw);
            if (Array.isArray(cached.notices)) {
              firstCursor.current = cached.nextCursor;
              setPage(cached);
              rememberPage(cacheKey, cached);
              setLoaded(true);
            }
          } catch {}
        }
      }
      const result = await readNotifications(
        more ? page.nextCursor! : undefined,
        category
      );
      if (
        !alive.current ||
        before !== revision.current ||
        (await currentAccountId()) !== owner
      )
        return false;
      if (!more) firstCursor.current = result.nextCursor;
      if (!manual && !more && loaded && dataChanged(page.notices, result.notices)) { setPendingPage(result); setError(""); return true; }
      setPendingPage(undefined);
      setLoaded(true);
      setPage((previous) => {
        const next = more
          ? {
              ...result,
              notices: [
                ...previous.notices,
                ...result.notices.filter(
                  (item) => !previous.notices.some((old) => old.id === item.id)
                ),
              ],
            }
          : result;
        rememberPage(cacheKey, next);
        return next;
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
    if (!user || loadedOwner.current !== user.id) return;
    const owner = user.id;
    const before = revision.current;
    const idle = requestIdleCallback(() => {
      void currentAccountId().then((current) => {
        if (alive.current && current === owner && before === revision.current)
          writeShellValue(
            `social.notifications.${owner}.${category}`,
            JSON.stringify({
              ...page,
              notices: page.notices.slice(0, 50),
              nextCursor: firstCursor.current,
            })
          );
      });
    });
    return () => cancelIdleCallback(idle);
  }, [page, user?.id, category]);
  useEffect(() => {
    if (count === 0)
      setPage((previous) =>
        previous.notices.some((item) => !item.read)
          ? {
              ...previous,
              unreadCount: 0,
              notices: previous.notices.map((item) => ({
                ...item,
                read: true,
              })),
            }
          : previous
      );
  }, [count]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    revision.current++;
    const cached = cachedPage<NoticePage>(cacheKey);
    setPage(cached ?? { notices: [], nextCursor: null, unreadCount: 0 });
    setPendingPage(undefined);
    firstCursor.current = cached?.nextCursor ?? null;
    loadedOwner.current = cached ? user?.id : undefined;
    setLoading(Boolean(user));
    setLoaded(!!cached);
    setLoadingMore(false);
    setError("");
  }, [user?.id]);
  useEffect(() => {
    if (!focused) return;
    const idle = requestIdleCallback(() => {
      void load(false, false);
    });
    return () => cancelIdleCallback(idle);
  }, [focused, user?.id]);
  useEffect(() => {
    const increased = count > seenCount.current;
    seenCount.current = count;
    if (!focused || !increased) return;
    const idle = requestIdleCallback(() => {
      void reload.current();
    });
    return () => cancelIdleCallback(idle);
  }, [count, focused]);
  async function act(notice?: Notice) {
    if (writing.current || !user) return;
    writing.current = true;
    setPendingPage(undefined);
    setActing(true);
    revision.current++;
    const owner = user.id;
    try {
      if (notice && !(await onOpen(notice))) return;
      if (!alive.current || (await currentAccountId()) !== owner) return;
      const result = await markNotificationsRead(
        notice ? [notice.id] : undefined
      );
      if (!alive.current || (await currentAccountId()) !== owner) return;
      remember({
        ...page,
        unreadCount: result.unreadCount,
        notices: page.notices.map((item) =>
          (!notice || item.id === notice.id) && item.createdAt <= result.before
            ? { ...item, read: true }
            : item
        ),
      });
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
        setActing(false);
        if (reading.current) again.current = true;
        else if (!page.notices.length) void reload.current();
      }
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {pendingPage ? <NewDataNotice label="查看新通知" onPress={() => { firstCursor.current = pendingPage.nextCursor; remember(pendingPage); setPendingPage(undefined); list.current?.scrollToOffset({ offset: 0, animated: false }); }} /> : null}
      <GestureDetector gesture={gesture}>
        <View style={{ flex: 1, overflow: "hidden" }}>
          <PullIndicator pull={pull} phase={phase} />
          <Animated.View style={[{ flex: 1 }, lift]}>
            <GestureDetector gesture={scrollGesture}>
              <Animated.FlatList<Notice>
                ref={list}
                data={user ? page.notices : []}
                contentContainerStyle={!user || !page.notices.length ? { flexGrow: 1 } : undefined}
                keyExtractor={(item) => item.id}
                onScroll={onScroll}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                bounces={false}
                overScrollMode="never"
                scrollEnabled={phase !== "refreshing" && phase !== "done"}
                removeClippedSubviews={false}
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
                renderItem={({ item }) => (
                  <Pressy
                    disabled={acting}
                    accessibilityLabel={`${noticeHeading(item)}${
                      item.read ? "" : "，未读"
                    }`}
                    onPress={() => void act(item)}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      flexDirection: "row",
                      gap: 10,
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.line,
                      backgroundColor: item.read
                        ? colors.canvas
                        : colors.accentTint,
                    }}
                  >
                    <UserAvatar uri={item.actor.avatarUrl} authorId={item.actor.id} size={40} />
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      <Text style={{ color: colors.ink1, fontSize: 14 }}>
                        {noticeHeading(item)}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{
                          color: colors.ink1,
                          fontSize: 14,
                          lineHeight: 21,
                        }}
                      >
                        {item.body}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.ink3, fontSize: 12 }}
                      >
                        {item.postPreview}
                      </Text>
                      <Text
                        style={{
                          color: colors.ink3,
                          fontSize: 11,
                          fontFamily: colors.mono,
                        }}
                      >
                        {new Date(item.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    {!item.read ? (
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 4,
                          backgroundColor: colors.accent,
                          marginTop: 6,
                        }}
                      />
                    ) : null}
                  </Pressy>
                )}
                ListEmptyComponent={
                  <EmptyState style={user && loading && !loaded ? { flexGrow: 0, alignItems: "stretch", padding: 16 } : undefined}>
                    {user && loading && !loaded ? (
                      <PageSkeleton rows={4} />
                    ) : (
                      <Text style={{ color: colors.ink3 }}>
                        {user
                          ? category === "creation"
                            ? "制作完成或失败，会在这里通知你"
                            : "评论和回复会出现在这里"
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
                        style={{ padding: 12 }}
                      >
                        <Text style={{ color: colors.accentText }}>
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
                        <ActivityIndicator color={colors.accent} />
                      ) : (
                        <Text
                          style={{
                            color: colors.accentText,
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
            </GestureDetector>
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}
