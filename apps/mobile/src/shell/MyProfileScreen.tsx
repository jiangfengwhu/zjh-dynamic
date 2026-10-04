import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { ProfileScrollContext, PROFILE_RANGE } from "./ProfileScroll";
import { AppImage } from "../../../../packages/ui/media/AppImage";
import { ThemeContext, useTheme } from "../../../../packages/ui/theme";
import { usePixelTheme } from "./feed/pixelTheme";
import { useAccount, requireAccount } from "./account";
import { CompactTabs } from "./CompactTabs";
import { AuthorProfileScreen } from "./feed/AuthorProfileScreen";
import { MyApplicationsScreen } from "./MyApplicationsScreen";
import { PixelAvatar, PixelIcon } from "./feed/PixelKit";
import { useProfileDrawer, showProfileDrawer } from "./ProfileDrawer";
import type { UserPost, PublicAuthor } from "./feed/userPosts";
import type { MarketApplication } from "./market";

export function MyProfileScreen(props: Parameters<typeof MyProfileContent>[0]) {
  const theme = usePixelTheme();
  return (
    <ThemeContext.Provider value={theme}>
      <MyProfileContent {...props} />
    </ThemeContext.Provider>
  );
}
function MyProfileContent({
  onAccount,
  onPost,
  onApplication,
  onDetail,
  onOpen,
  onCreate,
  onSharePost,
}: {
  onAccount: () => void;
  onPost: (post: UserPost) => void;
  onApplication: (id: string) => Promise<void>;
  onDetail: (item: MarketApplication) => void;
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
  }>();
  const onProfileLoaded = useCallback(
    (profile: import("./feed/userPosts").AuthorProfile) =>
      setStats({
        id: profile.author.id,
        publicCount: profile.applications.length,
        followers: profile.followerCount ?? 0,
      }),
    [],
  );
  const collapsed = useSharedValue(0);
  const active = useSharedValue("posts");
  const [viewport, setViewport] = useState(0);
  useEffect(() => {
    collapsed.value = 0;
  }, [user?.id, collapsed]);
  const identityMotion = useAnimatedStyle(() => ({
    opacity: 1 - collapsed.value / PROFILE_RANGE,
    transform: [{ translateY: -collapsed.value }],
  }));
  const tabsMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: -collapsed.value }],
  }));
  const avatarPosition = useAnimatedStyle(() => ({
    transform: [
      { translateX: (-30 * collapsed.value) / PROFILE_RANGE },
      { translateY: (-80 * collapsed.value) / PROFILE_RANGE },
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
  function selectTab(value: "posts" | "works") {
    active.value = value;
    setTab(value);
  }
  const { gesture } = useProfileDrawer();
  const author: PublicAuthor | undefined = user
    ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl }
    : undefined;
  return (
    <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={{ flex: 1 }}>
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
          <Animated.Text
            accessibilityRole="header"
            style={[
              { color: colors.ink1, fontSize: 21, fontWeight: "700" },
              expandedTitle,
            ]}
          >
            我的
          </Animated.Text>
          <Animated.Text
            numberOfLines={1}
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: 60,
                right: 64,
                top: 14,
                color: colors.ink1,
                fontSize: 18,
                fontWeight: "700",
              },
              compactTitle,
            ]}
          >
            {user?.name ?? "我的"}
          </Animated.Text>
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
            <PixelIcon name="more" size={20} color={colors.ink1} />
          </Pressy>
        </View>
        <View
          style={{ flex: 1 }}
          onLayout={(event) => setViewport(event.nativeEvent.layout.height)}
        >
          <ProfileScrollContext.Provider
            value={{ active, collapsed, viewport }}
          >
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
              pointerEvents="none"
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
                  <Text style={{ color: colors.ink3, fontSize: 12 }}>
                    {stats?.id === user?.id && stats
                      ? `${stats.publicCount} 份公开作品 · ${stats.followers} 位关注者`
                      : user
                        ? "我的创造与分享"
                        : "记录创造，收藏自己的作品"}
                  </Text>
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
                    value={tab}
                    options={[
                      { id: "posts", label: "动态", icon: "feed" },
                      { id: "works", label: "作品", icon: "box" },
                    ]}
                    onChange={selectTab}
                  />
                </Animated.View>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flex: 1,
                      display: tab === "posts" ? "flex" : "none",
                    }}
                  >
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
                  <View
                    style={{
                      flex: 1,
                      display: tab === "works" ? "flex" : "none",
                    }}
                  >
                    <MyApplicationsScreen
                      key={author.id}
                      embedded
                      active={tab === "works"}
                      drawerGesture={gesture}
                      onCreate={onCreate}
                      onOpen={onOpen}
                      onDetail={onDetail}
                      onSharePost={onSharePost}
                    />
                  </View>
                </View>
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
              {user?.avatarUrl ? (
                <AppImage
                  source={{ uri: user.avatarUrl }}
                  style={{ width: 56, height: 56, borderRadius: 28 }}
                />
              ) : (
                <PixelAvatar size={56} />
              )}
            </Animated.View>
          </Pressy>
        </Animated.View>
      </View>
    </Screen>
  );
}
