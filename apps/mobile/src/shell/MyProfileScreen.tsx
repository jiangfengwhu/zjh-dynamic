import { useState } from "react";
import { Text, View } from "react-native";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { AppImage } from "../../../../packages/ui/media/AppImage";
import { useTheme } from "../../../../packages/ui/theme";
import { useAccount, requireAccount } from "./account";
import { CompactTabs } from "./CompactTabs";
import { AuthorProfileScreen } from "./feed/AuthorProfileScreen";
import { MyApplicationsScreen } from "./MyApplicationsScreen";
import { PixelAvatar, PixelIcon } from "./feed/PixelKit";
import { useProfileDrawer, showProfileDrawer } from "./ProfileDrawer";
import type { UserPost, PublicAuthor } from "./feed/userPosts";
import type { MarketApplication } from "./market";

export function MyProfileScreen({
  onAccount,
  onPost,
  onApplication,
  onDetail,
  onOpen,
  onCreate,
}: {
  onAccount: () => void;
  onPost: (post: UserPost) => void;
  onApplication: (id: string) => Promise<void>;
  onDetail: (item: MarketApplication) => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
}) {
  const { colors } = useTheme();
  const { user } = useAccount();
  const [tab, setTab] = useState<"posts" | "works">("posts");
  const { gesture } = useProfileDrawer();
  const author: PublicAuthor | undefined = user
    ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl }
    : undefined;
  return (
    <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PageHeader
        title="我的"
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
          paddingBottom: 16,
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
            {user ? "编辑头像与昵称" : "记录创造，收藏自己的作品"}
          </Text>
        </View>
      </Pressy>
      {author ? (
        <>
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <CompactTabs
              value={tab}
              options={[
                { id: "posts", label: "动态" },
                { id: "works", label: "作品" },
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
