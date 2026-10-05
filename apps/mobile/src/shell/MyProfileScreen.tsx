import { Text } from "../../../../packages/ui/primitives/Typography";
import { UserAvatar } from "./UserAvatar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  useEvent,
  runOnJS,
  runOnUI,
} from "react-native-reanimated";
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
  type PageScrollStateChangedNativeEvent,
} from "react-native-pager-view";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import { ProfileScrollContext, PROFILE_RANGE } from "./ProfileScroll";
import { ThemeContext, useTheme } from "../../../../packages/ui/theme";

import { useAccount, requireAccount } from "./account";
import { CompactTabs } from "./CompactTabs";
import { AuthorProfileScreen } from "./feed/AuthorProfileScreen";
import { MyApplicationsScreen } from "./MyApplicationsScreen";
import { SymbolIcon } from "./feed/PixelKit";
import { useProfileDrawer, showProfileDrawer } from "./ProfileDrawer";
import { fetchAuthorProfile } from "./feed/userPosts";
import type { UserPost, PublicAuthor } from "./feed/userPosts";
import type { RelationKind } from "./social/api";
import type { MarketApplication } from "./market";

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);
const AnimatedThemeText = Animated.createAnimatedComponent(Text);

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
  const { user } = useAccount();
  const [tab, setTab] = useState<"posts" | "works">("posts");
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
          (((headerWidth.value - titleWidth.value) / 2 - 46) *
            collapsed.value) /
          PROFILE_RANGE,
      },
      { translateY: (-76 * collapsed.value) / PROFILE_RANGE },
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
            height: 52,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            zIndex: 10,
            backgroundColor: colors.canvas,
          }}
        >
          <AnimatedThemeText
            accessibilityRole="header"
            style={[
              { color: colors.ink1, fontSize: 21, fontWeight: "700" },
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
                  fontSize: 18,
                  lineHeight: 24,
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
            style={{
              width: 44,
              height: 44,
              marginLeft: "auto",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolIcon name="more" size={20} color={colors.ink1} />
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
                  backgroundColor: colors.canvas,
                },
                identityMask,
              ]}
            />
            <Animated.View
              style={[
                {
                  position: "absolute",
                  top: 0,
                  left: 16,
                  right: 16,
                  height: 108,
                  zIndex: 12,
                },
                identityMotion,
              ]}
              pointerEvents="box-none"
            >
              <View
                style={{
                  height: 84,
                  marginTop: 8,
                  paddingLeft: 84,
                  paddingRight: 14,
                  backgroundColor: colors.greenTint,
                  borderRadius: 12,
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
                      fontSize: 22,
                      fontWeight: "700",
                    }}
                  >
                    {user?.name ?? "登录紫金花"}
                  </Text>
                  {author ? <View style={{ flexDirection: "row", gap: 12 }}>
                    <Pressy accessibilityRole="button" accessibilityLabel="查看我的关注" onPress={() => onConnections(author, "following")} style={{ minHeight: 44, justifyContent: "center" }}>
                      <Text style={{ color: colors.greenText, fontSize: 12 }}>{stats?.id === user?.id ? stats?.following ?? "—" : "—"} 关注</Text>
                    </Pressy>
                    <Pressy accessibilityRole="button" accessibilityLabel="查看我的粉丝" onPress={() => onConnections(author, "followers")} style={{ minHeight: 44, justifyContent: "center" }}>
                      <Text style={{ color: colors.orchidText, fontSize: 12 }}>{stats?.id === user?.id ? stats?.followers ?? "—" : "—"} 粉丝</Text>
                    </Pressy>
                  </View> : <Text style={{ color: colors.ink3, fontSize: 12 }}>记录创造，收藏自己的作品</Text>}

                </View>
              </View>
            </Animated.View>
            {author ? (
              <>
                <Animated.View
                  style={[
                    {
                      position: "absolute",
                      top: 108,
                      left: 0,
                      right: 0,
                      height: 52,
                      paddingHorizontal: 16,
                      backgroundColor: colors.canvas,
                      zIndex: 15,
                    },
                    tabsMotion,
                  ]}
                >
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
                    </View>
                    <View key="works" collapsable={false} style={{ flex: 1 }}>
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
                    </View>
                  </AnimatedPagerView>
                </GestureDetector>
              </>
            ) : (
              <View
                style={{
                  padding: 24,
                  paddingTop: 132,
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Text style={{ color: colors.ink3 }}>
                  登录后查看你的动态和作品
                </Text>
                <Pressy
                  onPress={() => {
                    void requireAccount();
                  }}
                  style={{
                    minHeight: 44,
                    paddingHorizontal: 24,
                    borderRadius: 22,
                    backgroundColor: colors.accent,
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: colors.onAccent }}>登录</Text>
                </Pressy>
              </View>
            )}
          </ProfileScrollContext.Provider>
        </View>
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 74,
              left: 32,
              width: 56,
              height: 56,
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
              width: 56,
              height: 56,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Animated.View style={avatarScale}>
              <UserAvatar uri={user?.avatarUrl} size={56} />
            </Animated.View>
          </Pressy>
        </Animated.View>
      </View>
    </Screen>
  );
}
