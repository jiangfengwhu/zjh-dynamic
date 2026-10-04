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
import { AppImage } from "../../../../../packages/ui/media/AppImage";
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
          gap: 8,
        }}
      >
        {props.onBack ? (
          <Pressy
            accessibilityLabel="返回"
            onPress={props.onBack}
            style={{ width: 44, height: 44, justifyContent: "center" }}
          >
            <PixelIcon name="back" size={20} color={colors.ink1} />
          </Pressy>
        ) : null}
        <Text
          accessibilityRole="header"
          style={{ color: colors.ink1, fontSize: 18 }}
        >
          通知
        </Text>
        <View style={{ flex: 1, minWidth: 0 }}>
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
            <LoadingSkeleton />
          ) : (
            <PixelIcon
              name="check"
              size={20}
              color={count ? colors.accentText : colors.ink3}
            />
          )}
        </Pressy>
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
  const [page, setPage] = useState<NoticePage>({
    notices: [],
    nextCursor: null,
    unreadCount: 0,
  });
  const [loading, setLoading] = useState(Boolean(user));
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
  reload.current = () => load();
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
    setPage(next);
  }
  async function load(more = false) {
    if (!user || writing.current || (more && !page.nextCursor)) return false;
    if (reading.current) {
      if (!more) again.current = true;
      return false;
    }
    reading.current = true;
    setLoading(true);
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
    setPage({ notices: [], nextCursor: null, unreadCount: 0 });
    firstCursor.current = null;
    loadedOwner.current = undefined;
    setLoading(Boolean(user));
    setError("");
  }, [user?.id]);
  useEffect(() => {
    if (!focused) return;
    const idle = requestIdleCallback(() => {
      void load();
    });
    return () => cancelIdleCallback(idle);
  }, [focused, user?.id]);
  async function act(notice?: Notice) {
    if (writing.current || !user) return;
    writing.current = true;
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
      <GestureDetector gesture={gesture}>
        <View style={{ flex: 1, overflow: "hidden" }}>
          <PullIndicator pull={pull} phase={phase} />
          <Animated.View style={[{ flex: 1 }, lift]}>
            <GestureDetector gesture={scrollGesture}>
              <Animated.FlatList<Notice>
                data={user ? page.notices : []}
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
                    {item.actor.avatarUrl ? (
                      <AppImage
                        source={{ uri: item.actor.avatarUrl }}
                        style={{ width: 40, height: 40, borderRadius: 20 }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: colors.field,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: colors.accentText }}>
                          {Array.from(item.actor.name)[0]}
                        </Text>
                      </View>
                    )}
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
                  <View style={{ padding: 16, alignItems: "center" }}>
                    {loading ? (
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
                  </View>
                }
                ListFooterComponent={
                  page.nextCursor ? (
                    <Pressable
                      disabled={loading || acting}
                      onPress={() => void load(true)}
                      style={{ padding: 16 }}
                    >
                      {loading ? (
                        <LoadingSkeleton color={colors.accent} />
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
