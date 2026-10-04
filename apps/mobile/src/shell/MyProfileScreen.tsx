import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
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
    []
  );
  const { gesture } = useProfileDrawer();
  const author: PublicAuthor | undefined = user
    ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl }
    : undefined;
  return (
    <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PageHeader
        title="我的"
        variant="pixel"
        right={
          <Pressy
            accessibilityRole="button"
            accessibilityLabel="打开设置抽屉"
            onPress={showProfileDrawer}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PixelIcon name="more" size={20} color={colors.ink1} />
          </Pressy>
        }
      />
      <Pressy
        accessibilityRole="button"
        accessibilityLabel={user ? "编辑头像与昵称" : "登录"}
        onPress={onAccount}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 14,
          marginHorizontal: 16,
          marginTop: 8,
          marginBottom: 16,
          backgroundColor: colors.greenTint,
          borderRadius: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        {user?.avatarUrl ? (
          <AppImage
            source={{ uri: user.avatarUrl }}
            style={{ width: 56, height: 56, borderRadius: 28 }}
          />
        ) : (
          <PixelAvatar size={56} />
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{ color: colors.ink1, fontSize: 22, fontWeight: "700" }}
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
        <PixelIcon name="edit" size={16} color={colors.greenText} />
      </Pressy>
      {author ? (
        <>
          <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <CompactTabs
              value={tab}
              options={[
                { id: "posts", label: "动态", icon: "feed" },
                { id: "works", label: "作品", icon: "box" },
              ]}
              onChange={setTab}
            />
          </View>
          <View style={{ flex: 1 }}>
            <View
              style={{ flex: 1, display: tab === "posts" ? "flex" : "none" }}
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
              style={{ flex: 1, display: tab === "works" ? "flex" : "none" }}
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
        <View style={{ padding: 24, alignItems: "center", gap: 12 }}>
          <Text style={{ color: colors.ink3 }}>登录后查看你的动态和作品</Text>
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
    </Screen>
  );
}
