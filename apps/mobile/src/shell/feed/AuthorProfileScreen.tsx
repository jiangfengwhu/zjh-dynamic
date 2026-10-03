import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
import { AppImage } from "../../../../../packages/ui/media/AppImage";
import { CompactTabs } from "../CompactTabs";
import { PageHeader } from "../../../../../packages/ui/chrome";
import { Screen } from "../../../../../packages/ui/edge";
import { useTheme } from "../../../../../packages/ui/theme";
import { useAccount, requireAccount, currentAccountId } from "../account";
import Toast from "react-native-toast-message";
import { ApplicationPostCard } from "./ApplicationPostCard";
import { UserPostCard } from "./UserPostCard";
import { usePullToRefresh } from "./pullToRefresh";
import { PullIndicator } from "./PullIndicator";
import {
  fetchAuthorPosts,
  fetchAuthorProfile,
  setAuthorFollow,
  useUserPosts,
  type AuthorProfile,
  type PublicAuthor,
  type UserPost,
} from "./userPosts";

type ProfileRow =
  | { type: "post"; post: UserPost }
  | { type: "app"; app: AuthorProfile["applications"][number] };

export function AuthorProfileScreen({
  initialAuthor,
  onBack,
  onPost,
  onApplication,
}: {
  initialAuthor: PublicAuthor;
  onBack: () => void;
  onPost: (post: UserPost) => void;
  onApplication: (appId: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const { user } = useAccount();
  const timeline = useUserPosts();
  const focused = useIsFocused();
  const [profile, setProfile] = useState<AuthorProfile>(() => ({
    author: initialAuthor,
    posts: timeline.posts.filter((post) => post.author.id === initialAuthor.id),
    applications: [],
    nextCursor: null,
  }));
  const [tab, setTab] = useState<"posts" | "apps">("posts");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  const reading = useRef(false);
  const revision = useRef(0);
  const rerun = useRef(false);
  const identity = useRef(user?.id);
  const [followBusy, setFollowBusy] = useState(false);
  const followPending = useRef(false);
  async function toggleFollow() {
    if (followPending.current) return;
    followPending.current = true;
    try {
      if (!(await requireAccount())) return;
      const owner = await currentAccountId();
      if (owner === initialAuthor.id) return;
      revision.current++;
      if (reading.current) rerun.current = true;
      setFollowBusy(true);
      const result = await setAuthorFollow(
        initialAuthor.id,
        !profile.following
      );
      if (!alive.current || (await currentAccountId()) !== owner) return;
      revision.current++;
      if (reading.current) rerun.current = true;
      setProfile((previous) => ({ ...previous, ...result }));
    } catch (cause) {
      if (alive.current)
        Toast.show({
          type: "error",
          text1: "关注未完成",
          text2: cause instanceof Error ? cause.message : "请重试",
        });
    } finally {
      followPending.current = false;
      if (alive.current) setFollowBusy(false);
    }
  }
  const list = useRef<FlatList<ProfileRow>>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const { pull, phase, gesture, scrollGesture } = usePullToRefresh({
    scrollY,
    onRefresh: () => load(),
  });
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: pull.value }],
  }));
  async function load(more = false) {
    if (reading.current) {
      if (!more) rerun.current = true;
      return false;
    }
    if (more && !profile.nextCursor) return false;
    reading.current = true;
    setBusy(true);
    const before = revision.current;
    try {
      const result = more
        ? await fetchAuthorPosts(initialAuthor.id, profile.nextCursor!)
        : await fetchAuthorProfile(initialAuthor.id);
      if (!alive.current || before !== revision.current) return false;
      setProfile((previous) =>
        more
          ? {
              ...previous,
              posts: [
                ...previous.posts,
                ...result.posts.filter(
                  (item) => !previous.posts.some((old) => old.id === item.id)
                ),
              ],
              nextCursor: result.nextCursor,
            }
          : (result as AuthorProfile)
      );
      setLoaded(true);
      setError("");
      return true;
    } catch (cause) {
      if (alive.current && before === revision.current)
        setError(cause instanceof Error ? cause.message : "主页暂时无法加载");
      return false;
    } finally {
      reading.current = false;
      if (alive.current) {
        setBusy(false);
        if (rerun.current) {
          rerun.current = false;
          void load();
        }
      }
    }
  }
  useEffect(
    () => () => {
      alive.current = false;
    },
    []
  );
  useEffect(() => {
    revision.current++;
    if (identity.current !== user?.id) {
      identity.current = user?.id;
      setProfile((previous) => ({
        ...previous,
        posts: previous.posts.map((post) => ({ ...post, liked: false })),
      }));
    }
    if (focused) void load();
  }, [focused, user?.id]);
  function updated(post: UserPost) {
    revision.current++;
    if (reading.current) rerun.current = true;
    setProfile((previous) => ({
      ...previous,
      posts: previous.posts.map((item) => (item.id === post.id ? post : item)),
    }));
  }
  function deleted(id: string) {
    revision.current++;
    if (reading.current) rerun.current = true;
    setProfile((previous) => ({
      ...previous,
      posts: previous.posts.filter((post) => post.id !== id),
    }));
  }
  const author =
    profile.author.id === user?.id
      ? { ...profile.author, name: user.name, avatarUrl: user.avatarUrl }
      : profile.author;
  const header = (
    <View>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          {author.avatarUrl ? (
            <AppImage
              source={{ uri: author.avatarUrl }}
              style={{ width: 56, height: 56, borderRadius: 28 }}
            />
          ) : (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontSize: 23,
                  fontWeight: "700",
                  color: colors.onAccent,
                }}
              >
                {Array.from(author.name)[0]}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text
              numberOfLines={2}
              style={{
                fontSize: 22,
                lineHeight: 28,
                letterSpacing: -0.5,
                fontWeight: "800",
                color: colors.ink1,
              }}
            >
              {author.name}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {author.official ? (
                <Text style={{ fontSize: 11, color: colors.accentText }}>
                  官方创作者
                </Text>
              ) : null}
              {user?.id === author.id ? (
                <Text style={{ fontSize: 11, color: colors.ink3 }}>
                  我的主页
                </Text>
              ) : null}
              <Text style={{ color: colors.ink3, fontSize: 11 }}>
                {loaded
                  ? `${profile.applications.length} 个公开应用`
                  : error
                  ? "主页暂未同步"
                  : busy
                  ? "正在加载…"
                  : "作者主页"}
              </Text>
            </View>
          </View>
          {user?.id !== author.id ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={profile.following ? "取消关注" : "关注作者"}
              accessibilityState={{
                disabled: followBusy || busy,
                selected: !!profile.following,
              }}
              disabled={followBusy || busy}
              onPress={() => void toggleFollow()}
              style={{
                minHeight: 44,
                minWidth: 76,
                paddingHorizontal: 12,
                borderRadius: 22,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: profile.following
                  ? colors.inset
                  : colors.accent,
                opacity: followBusy || busy ? 0.6 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: profile.following ? colors.ink2 : colors.onAccent,
                }}
              >
                {followBusy
                  ? "处理中…"
                  : profile.following
                  ? "已关注"
                  : "+ 关注"}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {loaded ? (
          <Text style={{ fontSize: 12, color: colors.ink3 }}>
            {profile.followingCount ?? 0} 关注 · {profile.followerCount ?? 0}{" "}
            关注者
          </Text>
        ) : null}
        <CompactTabs
          value={tab}
          options={[
            { id: "posts", label: "动态" },
            { id: "apps", label: "应用" },
          ]}
          onChange={(value) => {
            setTab(value);
            list.current?.scrollToOffset({ offset: 0, animated: false });
            scrollY.value = 0;
          }}
        />
      </View>
      {error ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void load()}
          style={{ paddingHorizontal: 16, paddingBottom: 12 }}
        >
          <Text style={{ color: colors.danger }}>{error} · 点击重试</Text>
        </Pressable>
      ) : null}
    </View>
  );
  return (
    <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PageHeader title="作者主页" onBack={onBack} />
      <GestureDetector gesture={gesture}>
        <View style={{ flex: 1, overflow: "hidden" }}>
          <PullIndicator pull={pull} phase={phase} />
          <Animated.View style={[{ flex: 1 }, lift]}>
            <GestureDetector gesture={scrollGesture}>
              <Animated.FlatList<ProfileRow>
                ref={list}
                data={
                  tab === "posts"
                    ? profile.posts.map((post) => ({
                        type: "post" as const,
                        post,
                      }))
                    : profile.applications.map((app) => ({
                        type: "app" as const,
                        app,
                      }))
                }
                keyExtractor={(row) =>
                  row.type === "post" ? row.post.id : row.app.manifest.appId
                }
                removeClippedSubviews={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                overScrollMode="never"
                bounces={false}
                scrollEnabled={phase !== "refreshing" && phase !== "done"}
                ListHeaderComponent={header}
                renderItem={({ item: row }) => {
                  if (row.type === "app") {
                    const item = row.app;
                    return (
                      <View
                        style={{ paddingHorizontal: 16, paddingVertical: 6 }}
                      >
                        <ApplicationPostCard
                          application={{
                            ...item.manifest,
                            title: item.title || item.manifest.title,
                            summary: item.summary ?? item.manifest.summary,
                          }}
                          onOpen={onApplication}
                        />
                      </View>
                    );
                  }
                  const item = row.post;
                  return (
                    <View
                      style={{
                        borderBottomWidth: 0.5,
                        borderBottomColor: colors.line,
                      }}
                    >
                      <UserPostCard
                        post={{ ...item, author }}
                        time={new Date(item.createdAt).toLocaleDateString()}
                        own={user?.id === item.author.id}
                        onOpen={() => onPost(item)}
                        onApplication={onApplication}
                        onUpdated={updated}
                        onDeleted={() => deleted(item.id)}
                      />
                    </View>
                  );
                }}
                ListEmptyComponent={
                  loaded && !error ? (
                    <Text
                      style={{
                        textAlign: "center",
                        padding: 16,
                        color: colors.ink3,
                      }}
                    >
                      {tab === "apps" ? "还没有公开应用" : "还没有公开动态"}
                    </Text>
                  ) : null
                }
                ListFooterComponent={
                  <View style={{ padding: 16 }}>
                    {busy && !loaded ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : tab === "posts" && profile.nextCursor ? (
                      <Pressable
                        disabled={busy}
                        onPress={() => void load(true)}
                        style={{ padding: 14 }}
                      >
                        {busy ? (
                          <ActivityIndicator color={colors.accent} />
                        ) : (
                          <Text
                            style={{
                              textAlign: "center",
                              color: colors.accentText,
                            }}
                          >
                            加载更多动态
                          </Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                }
              />
            </GestureDetector>
          </Animated.View>
        </View>
      </GestureDetector>
    </Screen>
  );
}
