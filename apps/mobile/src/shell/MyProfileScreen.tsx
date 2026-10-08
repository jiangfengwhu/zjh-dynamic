import { lazyScreen } from "./lazyScreen";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { UserAvatar } from "./UserAvatar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientFill, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useEvent,
  runOnJS,
  runOnUI,
} from "react-native-reanimated";
import { useVisitedPager } from "./useVisitedPager";
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
  type PageScrollStateChangedNativeEvent,
} from "react-native-pager-view";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import { ProfileScrollContext, PROFILE_RANGE, PROFILE_TABS } from "./ProfileScroll";
import { ThemeContext, useTheme } from "../../../../packages/ui/theme";

import { useAccount, requireAccount } from "./account";
import { CompactTabs } from "./CompactTabs";
const AuthorProfileScreen = lazyScreen(() => (require("./feed/AuthorProfileScreen") as typeof import("./feed/AuthorProfileScreen")).AuthorProfileScreen);
const MyApplicationsScreen = lazyScreen(() => (require("./MyApplicationsScreen") as typeof import("./MyApplicationsScreen")).MyApplicationsScreen);
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { useProfileDrawer, showProfileDrawer } from "./ProfileDrawer";
import { fetchAuthorProfile } from "./feed/userPosts";
import type { UserPost, PublicAuthor } from "./feed/userPosts";
import type { RelationKind } from "./social/api";
import type { MarketApplication } from "./market";

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);
const AnimatedThemeText = Animated.createAnimatedComponent(Text);
/** 顶栏（标题与设置按钮）高度；身份区与切换条的氛围底按它对齐页面。 */
const HEADER_HEIGHT = 52;
/** 身份行在身份区内的上边距与高度；头像在身份行内垂直居中。 */
const IDENTITY_TOP = 2;
const IDENTITY_HEIGHT = 68;
const AVATAR_SIZE = 56;
const AVATAR_TOP = HEADER_HEIGHT + IDENTITY_TOP + (IDENTITY_HEIGHT - AVATAR_SIZE) / 2;
/** 折叠完成时头像（缩到一半）的中心与顶栏中线对齐。 */
const AVATAR_LIFT = AVATAR_TOP + AVATAR_SIZE / 2 - HEADER_HEIGHT / 2;

export function MyProfileScreen(props: Parameters<typeof MyProfileContent>[0]) {
  const theme = useTheme();
  return (
    <ThemeContext.Provider value={theme}>
      <MyProfileContent {...props} />
    </ThemeContext.Provider>
  );
}
function MyProfileContent({
  onAccount,
  onConnections,
  onPost,
  onApplication,
  onDetail,
  onManagePublication,
  onOpen,
  onCreate,
  onSharePost,
}: {
  onAccount: () => void;
  onConnections: (author: PublicAuthor, kind: RelationKind) => void;
  onPost: (post: UserPost) => void;
  onApplication: (id: string) => Promise<void>;
  onDetail: (item: MarketApplication) => void;
  onManagePublication: (item: MarketApplication) => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onSharePost: (item: MarketApplication) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAccount();
  const [tab, setTab] = useState<"posts" | "works">("posts");
  const { visited, reveal } = useVisitedPager();
  const [stats, setStats] = useState<{
    id: string;
    publicCount: number;
    followers: number;
    following: number;
  }>();
  const onProfileLoaded = useCallback(
    (profile: import("./feed/userPosts").AuthorProfile) =>
      setStats({
        id: profile.author.id,
        publicCount: profile.applications.length,
        followers: profile.followerCount ?? 0,
        following: profile.followingCount ?? 0,
      }),
    []
  );
  useFocusEffect(useCallback(() => {
    if (!user) return;
    let live = true;
    const idle = requestIdleCallback(() => {
      void fetchAuthorProfile(user.id).then(profile => { if (live) onProfileLoaded(profile); }).catch(() => {});
    });
    return () => { live = false; cancelIdleCallback(idle); };
  }, [user?.id, onProfileLoaded]));
  const { width: windowWidth } = useWindowDimensions();
  const headerWidth = useSharedValue(windowWidth);
  const titleWidth = useSharedValue(76);
  const pager = useRef<PagerView>(null);
  const collapsed = useSharedValue(0);
  const paging = useSharedValue(false);
  const active = useSharedValue("posts");
  const [viewport, setViewport] = useState(0);
  useEffect(() => {
    collapsed.value = 0;
  }, [user?.id, collapsed]);
  const identityMask = useAnimatedStyle(() => ({
    height: Math.max(0, PROFILE_RANGE - collapsed.value),
  }));
  const identityMotion = useAnimatedStyle(() => ({
    opacity: 1 - collapsed.value / PROFILE_RANGE,
    transform: [{ translateY: -collapsed.value }],
  }));
  const tabsMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: -collapsed.value }],
  }));
  const avatarPosition = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          (((headerWidth.value - titleWidth.value) / 2 - 34) *
            collapsed.value) /
          PROFILE_RANGE,
      },
      { translateY: (-AVATAR_LIFT * collapsed.value) / PROFILE_RANGE },
    ],
  }));
  const avatarScale = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - (0.5 * collapsed.value) / PROFILE_RANGE }],
  }));
  const expandedTitle = useAnimatedStyle(() => ({
    opacity: 1 - collapsed.value / PROFILE_RANGE,
  }));
  const compactTitle = useAnimatedStyle(() => ({
    opacity: collapsed.value / PROFILE_RANGE,
  }));
  const { gesture, profileActive, profilePosition } = useProfileDrawer();
  useFocusEffect(
    useCallback(() => {
      const hasProfile = !!user;
      runOnUI(() => {
        "worklet";
        profileActive.value = hasProfile;
      })();
      return () => {
        runOnUI(() => {
          "worklet";
          profileActive.value = false;
        })();
      };
    }, [profileActive, user?.id])
  );
  const nativeGesture = useMemo(
    () => Gesture.Native().requireExternalGestureToFail(gesture),
    [gesture]
  );
  const onPageScroll = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      "worklet";
      reveal(event.position, event.offset);
      profilePosition.value = event.position + event.offset;
    },
    ["onPageScroll"]
  );
  const onPageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    (event) => {
      "worklet";
      const value = event.position === 0 ? "posts" : "works";
      active.value = value;
      runOnJS(setTab)(value);
    },
    ["onPageSelected"]
  );
  const onPageScrollStateChanged = useEvent<PageScrollStateChangedNativeEvent>(
    (event) => {
      "worklet";
      paging.value = event.pageScrollState !== "idle";
    },
    ["onPageScrollStateChanged"]
  );
  function selectTab(value: "posts" | "works") {
    if (value === tab) return;
    paging.value = true;
    pager.current?.setPage(value === "posts" ? 0 : 1);
  }
  const author: PublicAuthor | undefined = user
    ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl }
    : undefined;
  return (
    <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View
        style={{ flex: 1 }}
        onLayout={(event) => {
          headerWidth.value = event.nativeEvent.layout.width;
        }}
      >
        <View
          style={{
            height: HEADER_HEIGHT,
            paddingLeft: 16,
            paddingRight: 12,
            flexDirection: "row",
            alignItems: "center",
            zIndex: 10,
          }}
        >
          <AnimatedThemeText
            accessibilityRole="header"
            style={[
              { color: colors.ink1, ...colors.type.display },
              expandedTitle,
            ]}
          >
            我的
          </AnimatedThemeText>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 64,
                right: 64,
                alignItems: "center",
                justifyContent: "center",
              },
              compactTitle,
            ]}
          >
            <View
              onLayout={(event) => {
                titleWidth.value = event.nativeEvent.layout.width;
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View style={{ width: 28, height: 28 }} />
              <Text
                numberOfLines={1}
                style={{
                  maxWidth: Math.max(0, windowWidth - 164),
                  color: colors.ink1,
                  fontSize: 16,
                  lineHeight: 21,
                  fontWeight: "700",
                }}
              >
                {user?.name ?? "我的"}
              </Text>
            </View>
          </Animated.View>
          <Pressy
            accessibilityRole="button"
            accessibilityLabel="打开设置抽屉"
            onPress={showProfileDrawer}
            hitSlop={6}
            style={{
              width: 36,
              height: 36,
              minWidth: 36,
              minHeight: 36,
              marginLeft: "auto",
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surfaceRaised,
            }}
          >
            <SymbolIcon name="more" size={18} strokeWidth={2.1} color={colors.ink1} />
          </Pressy>
        </View>
        <View
          style={{ flex: 1 }}
          onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
        >
          <ProfileScrollContext.Provider
            value={{ active, collapsed, paging, viewport }}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  zIndex: 11,
                  overflow: "hidden",
                },
                identityMask,
              ]}
            >
              <AmbientFill offset={insets.top + HEADER_HEIGHT} />
            </Animated.View>
            <Animated.View
              style={[
                {
                  position: "absolute",
                  top: 0,
                  left: 20,
                  right: 16,
                  height: PROFILE_RANGE,
                  zIndex: 12,
                },
                identityMotion,
              ]}
              pointerEvents="box-none"
            >
              <View
                style={{
                  height: IDENTITY_HEIGHT,
                  marginTop: IDENTITY_TOP,
                  paddingLeft: 72,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: colors.ink1,
                      ...colors.type.title2,
                      fontWeight: "800",
                      fontSize: 17,
                      lineHeight: 22,
                    }}
                  >
                    {user?.name ?? "登录账号"}
                  </Text>
                  {author ? <View style={{ flexDirection: "row", gap: 16 }}>
                    <Pressy accessibilityRole="button" accessibilityLabel="查看我的关注" hitSlop={{ top: 10, bottom: 10 }} onPress={() => onConnections(author, "following")} style={{ minHeight: 24, minWidth: 0, justifyContent: "center" }}>
                      <Text style={{ color: colors.ink3, fontSize: 13 }}><Text style={{ color: colors.ink1, fontSize: 16, fontWeight: "800", letterSpacing: -0.3 }}>{stats?.id === user?.id ? stats?.following ?? "—" : "—"}</Text> 关注</Text>
                    </Pressy>
                    <Pressy accessibilityRole="button" accessibilityLabel="查看我的粉丝" hitSlop={{ top: 10, bottom: 10 }} onPress={() => onConnections(author, "followers")} style={{ minHeight: 24, minWidth: 0, justifyContent: "center" }}>
                      <Text style={{ color: colors.ink3, fontSize: 13 }}><Text style={{ color: colors.ink1, fontSize: 16, fontWeight: "800", letterSpacing: -0.3 }}>{stats?.id === user?.id ? stats?.followers ?? "—" : "—"}</Text> 粉丝</Text>
                    </Pressy>
                  </View> : <Text style={{ color: colors.ink3, fontSize: 13 }}>记录创造，收藏自己的作品</Text>}

                </View>
              </View>
            </Animated.View>
            {author ? (
              <>
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      top: PROFILE_RANGE,
                      left: 0,
                      right: 0,
                      height: PROFILE_TABS,
                      paddingHorizontal: 16,
                      justifyContent: "center",
                      zIndex: 15,
                    },
                    tabsMotion,
                  ]}
                >
                  <AmbientFill offset={insets.top + HEADER_HEIGHT + PROFILE_RANGE} shift={collapsed} />
                  <CompactTabs
                    position={profilePosition}
                    value={tab}
                    options={[
                      { id: "posts", label: "动态", icon: "feed" },
                      { id: "works", label: "作品", icon: "box" },
                    ]}
                    onChange={selectTab}
                  />
                </Animated.View>
                <GestureDetector gesture={nativeGesture}>
                  <AnimatedPagerView
                    key={author.id}
                    ref={pager}
                    style={{ flex: 1 }}
                    initialPage={tab === "posts" ? 0 : 1}
                    offscreenPageLimit={1}
                    overScrollMode="never"
                    onPageScroll={onPageScroll}
                    onPageSelected={onPageSelected}
                    onPageScrollStateChanged={onPageScrollStateChanged}
                  >
                    <View key="posts" collapsable={false} style={{ flex: 1 }}>
                      {visited.has(0) || tab === "posts" ? (
                      <AuthorProfileScreen
                        key={author.id}
                        initialAuthor={author}
                        embedded
                        active={tab === "posts"}
                        drawerGesture={gesture}
                        onPost={onPost}
                        onApplication={onApplication}
                        onProfileLoaded={onProfileLoaded}
                      />
                      ) : null}
                    </View>
                    <View key="works" collapsable={false} style={{ flex: 1 }}>
                      {visited.has(1) || tab === "works" ? (
                      <MyApplicationsScreen
                        key={author.id}
                        embedded
                        active={tab === "works"}
                        drawerGesture={gesture}
                        onCreate={onCreate}
                        onOpen={onOpen}
                        onDetail={onDetail}
                        onManagePublication={onManagePublication}
                        onSharePost={onSharePost}
                      />
                      ) : null}
                    </View>
                  </AnimatedPagerView>
                </GestureDetector>
              </>
            ) : (
              <View
                style={{
                  padding: 24,
                  paddingTop: PROFILE_RANGE + 24,
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text style={{ color: colors.ink3, fontSize: 14, lineHeight: 20 }}>
                  登录后查看你的动态和作品
                </Text>
                <Pressy
                  onPress={() => {
                    void requireAccount();
                  }}
                  style={{
                    minHeight: 40,
                    paddingHorizontal: 22,
                    borderRadius: 20,
                    backgroundColor: colors.accent,
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.onAccent, fontWeight: "700" }}>登录</Text>
                </Pressy>
              </View>
            )}
          </ProfileScrollContext.Provider>
        </View>
        <Animated.View
          style={[
            {
              position: "absolute",
              top: AVATAR_TOP,
              left: 20,
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              zIndex: 30,
            },
            avatarPosition,
          ]}
        >
          <Pressy
            scale={1}
            accessibilityRole="button"
            accessibilityLabel={user ? "编辑头像与昵称" : "登录"}
            onPress={onAccount}
            style={{
              width: AVATAR_SIZE,
              height: AVATAR_SIZE,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View style={avatarScale}>
              <UserAvatar uri={user?.avatarUrl} size={AVATAR_SIZE} />
            </Animated.View>
          </Pressy>
        </Animated.View>
      </View>
    </Screen>
  );
}
