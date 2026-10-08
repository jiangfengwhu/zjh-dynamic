import { useVisitedPager } from "../useVisitedPager";
import { Text } from "../../../../../packages/ui/primitives/Typography";
import { UserAvatar } from "../UserAvatar";
import { EmptyState } from "../EmptyState";
import { ActivityIndicator } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouteContentReady, useRouteRequestReady } from "../useRouteContentReady";
import { useIsFocused } from "@react-navigation/native";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useEvent,
  runOnJS,
  useSharedValue,
} from "react-native-reanimated";
import PagerView, { type PagerViewOnPageScrollEvent, type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import { Gesture } from "react-native-gesture-handler";
import { useProfileScroll } from "../ProfileScroll";
import { CompactTabs } from "../CompactTabs";
import type { RelationKind } from "../social/api";
import { PageHeader } from "../../../../../packages/ui/chrome";
import { Screen } from "../../../../../packages/ui/edge";
import { ThemeContext, useTheme } from "../../../../../packages/ui/theme";

import { useAccount, requireAccount, currentAccountId } from "../account";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { WorkCard } from "../WorkCard";
import { UserPostCard } from "./UserPostCard";
import { formatWhen } from "../formatTime";
import { usePullToRefresh } from "./pullToRefresh";
import { PullRefreshSurface } from "./PullRefreshSurface";
import {
  fetchAuthorPosts,
  fetchAuthorProfile,
  cachedAuthorProfile,
  setAuthorFollow,
  useUserPosts,
  type AuthorProfile,
  type PublicAuthor,
  type UserPost,
} from "./userPosts";

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);
type ProfileRow =
  | { type: "post"; post: UserPost }
  | { type: "app"; app: AuthorProfile["applications"][number] };

export function AuthorProfileScreen(
  props: Parameters<typeof AuthorProfileContent>[0],
) {
  const theme = useTheme();
  return (
    <ThemeContext.Provider value={theme}>
      <AuthorProfileContent {...props} />
    </ThemeContext.Provider>
  );
}
function AuthorProfileContent({
  initialAuthor,
  onBack,
  onPost,
  onApplication,
  embedded = false,
  active = true,
  drawerGesture,
  onProfileLoaded,
  onConnections,
  onMessage,
}: {
  initialAuthor: PublicAuthor;
  onBack?: () => void;
  embedded?: boolean;
  active?: boolean;
  drawerGesture?: ReturnType<typeof Gesture.Pan>;
  onPost: (post: UserPost) => void;
  onApplication: (appId: string) => Promise<void>;
  onProfileLoaded?: (profile: AuthorProfile) => void;
  onConnections?: (author: PublicAuthor, kind: RelationKind) => void;
  onMessage?: (author: PublicAuthor) => void;
}) {
  const { colors } = useTheme();
  const { user } = useAccount();
  const timeline = useUserPosts();
  const contentReady = useRouteContentReady(embedded);
  const requestReady = useRouteRequestReady(embedded);
  const focused = useIsFocused() && active && requestReady;
  const [profile, setProfile] = useState<AuthorProfile>(() => cachedAuthorProfile(initialAuthor.id) ?? ({
    author: initialAuthor,
    posts: timeline.posts.filter((post) => post.author.id === initialAuthor.id),
    applications: [],
    nextCursor: null,
  }));
  const { visited, visit, reveal } = useVisitedPager();
  const [tab, setTab] = useState<"posts" | "apps">("posts");
  const pager = useRef<PagerView>(null);
  const position = useSharedValue(0);
  const appY = useSharedValue(0);
  const appList = useAnimatedRef<import("react-native").FlatList<ProfileRow>>();
  const appScroll = useAnimatedScrollHandler(event => { appY.value = Math.max(0, event.contentOffset.y); });
  const onPageScroll = useEvent<PagerViewOnPageScrollEvent>(event => {
    "worklet"; reveal(event.position, event.offset); position.value = event.position + event.offset;
  }, ["onPageScroll"]);
  const onPageSelected = useEvent<PagerViewOnPageSelectedEvent>(event => {
    "worklet"; runOnJS(visit)(event.position); runOnJS(setTab)(event.position === 0 ? "posts" : "apps");
  }, ["onPageSelected"]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(() => !!cachedAuthorProfile(initialAuthor.id));
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
        !profile.following,
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
  const scrollY = useSharedValue(0);
  const profileScroll = useProfileScroll<ProfileRow>("posts", scrollY);
  const list = profileScroll.ref;
  const postsRefresh = usePullToRefresh({ scrollY, onRefresh: () => load() });
  const appsRefresh = usePullToRefresh({ scrollY: appY, onRefresh: () => load() });
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
      if (!more) onProfileLoaded?.(result as AuthorProfile);
      setProfile((previous) =>
        more
          ? {
              ...previous,
              posts: [
                ...previous.posts,
                ...result.posts.filter(
                  (item) => !previous.posts.some((old) => old.id === item.id),
                ),
              ],
              nextCursor: result.nextCursor,
            }
          : (result as AuthorProfile),
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
    [],
  );
  useEffect(() => {
    revision.current++;
    if (identity.current !== user?.id) {
      identity.current = user?.id;
      setProfile(cachedAuthorProfile(initialAuthor.id) ?? { author: initialAuthor, following: false, posts: [], applications: [], nextCursor: null });
      setLoaded(!!cachedAuthorProfile(initialAuthor.id));
    }
    if (!focused) return;
    const pending = requestIdleCallback(() => { void load(false); });
    return () => cancelIdleCallback(pending);
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
  const Root = embedded ? View : Screen;
  const header = (
    <View>
      {!embedded ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4 }}>
            <UserAvatar uri={author.avatarUrl} authorId={author.id} size={64} />
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
                  <Text style={{ fontSize: 12, fontWeight: "700", color: colors.accentText }}>
                    官方创作者
                  </Text>
                ) : null}
                {user?.id === author.id ? (
                  <Text style={{ fontSize: 12, color: colors.ink3 }}>
                    我的主页
                  </Text>
                ) : null}
                <Text style={{ color: colors.ink3, fontSize: 12 }}>
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
                  minHeight: 40,
                  minWidth: 76,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: profile.following
                    ? colors.surfaceRaised
                    : colors.accent,
                  opacity: followBusy || busy ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
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
            {onMessage && user?.id !== author.id ? <Pressable accessibilityRole="button" accessibilityLabel={`给${author.name}发私信`} onPress={() => onMessage(author)}
              style={{ minHeight: 40, minWidth: 58, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised, borderRadius: 20 }}>
              <Text style={{ color: colors.ink1, fontSize: 14, fontWeight: "700" }}>私信</Text>
            </Pressable> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 20, paddingHorizontal: 4 }}>
            {(["following", "followers"] as const).map(kind => <Pressable key={kind} accessibilityRole="button" accessibilityLabel={kind === "following" ? "查看关注" : "查看粉丝"} disabled={!onConnections}
              onPress={() => onConnections?.(author, kind)} style={{ minHeight: 36, justifyContent: "center" }}>
              <Text style={{ fontSize: 13, color: colors.ink3 }}><Text style={{ fontSize: 15, fontWeight: "800", color: colors.ink1 }}>{loaded ? (kind === "following" ? profile.followingCount ?? 0 : profile.followerCount ?? 0) : "—"}</Text> {kind === "following" ? "关注" : "粉丝"}</Text>
            </Pressable>)}
          </View>
          <CompactTabs
            value={tab}
            position={position}
            options={[
              { id: "posts", label: "动态", icon: "feed" },
              { id: "apps", label: "作品", icon: "box" },
            ]}
            onChange={(value) => {
              pager.current?.setPage(value === "posts" ? 0 : 1);
            }}
          />
        </View>
      ) : null}
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
  const renderPage = (tab: "posts" | "apps") => {
    const refresh = tab === "posts" ? postsRefresh : appsRefresh;
    return <PullRefreshSurface refresh={refresh} drawerGesture={drawerGesture} top={profileScroll.refreshOffset}>
              <Animated.FlatList<ProfileRow>
                ref={tab === "posts" ? list : appList}
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={5}
                data={
                  !contentReady && !loaded ? [] : tab === "posts"
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
                onScroll={tab === "posts" ? profileScroll.onScroll : appScroll}
                onLayout={tab === "posts" ? profileScroll.onLayout : undefined}
                onContentSizeChange={tab === "posts" ? profileScroll.onContentSizeChange : undefined}
                contentContainerStyle={[tab === "posts" ? profileScroll.contentStyle : undefined, !(tab === "posts" ? profile.posts.length : profile.applications.length) && (tab === "posts" ? profileScroll.emptyContentStyle : { flexGrow: 1 })]}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                overScrollMode="never"
                bounces={false}
                scrollEnabled={refresh.phase !== "refreshing" && refresh.phase !== "done"}
                renderItem={({ item: row, index }) => {
                  if (row.type === "app") {
                    const item = row.app;
                    return (
                      <View
                        style={{ paddingHorizontal: 12 }}
                      >
                        <WorkCard
                          application={item}
                          title={item.title || item.manifest.appName}
                          summary={item.summary ?? item.manifest.description}

                          authorName={author.name}
                          authorAvatarUrl={author.avatarUrl}
                          visibility="public"
                          tone={index}
                          onOpen={() => onApplication(item.manifest.appId)}
                        />
                      </View>
                    );
                  }
                  const item = row.post;
                  return (
                    <View
                      style={{
                        paddingHorizontal: 12,
                        paddingBottom: 10,
                      }}
                    >
                      <UserPostCard
                        post={{ ...item, author }}
                        time={formatWhen(item.createdAt)}
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
                    <EmptyState><Text
                      style={{
                        textAlign: "center",
                        padding: 16,
                        color: colors.ink3,
                      }}
                    >
                      {tab === "apps" ? "还没有公开作品" : "还没有公开动态"}
                    </Text></EmptyState>
                  ) : !loaded && !error ? (
                    <View accessibilityLabel="正在加载作者内容" style={{ padding: 16, gap: 16 }}>
                      {[0, 1, 2].map(key => <View key={key} style={{ gap: 10, paddingVertical: 12 }}>
                        <View style={{ width: "45%", height: 14, borderRadius: 4, backgroundColor: colors.inset }} />
                        <View style={{ height: tab === "apps" ? 96 : 54, borderRadius: 12, backgroundColor: colors.inset }} />
                        <View style={{ width: "70%", height: 10, borderRadius: 4, backgroundColor: colors.inset }} />
                      </View>)}
                    </View>
                  ) : null
                }
                ListFooterComponent={
                  <View style={{ padding: loaded && !(tab === "posts" && profile.nextCursor) ? 0 : 16 }}>
                    {contentReady && busy && !loaded ? (
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
    </PullRefreshSurface>;
  };
  return (
    <Root style={{ flex: 1, backgroundColor: colors.canvas }}>
      {!embedded ? (
        <PageHeader title="作者主页" onBack={onBack} />
      ) : null}
      {header}
      {embedded ? renderPage("posts") : (
        <AnimatedPagerView ref={pager} style={{ flex: 1 }} offscreenPageLimit={1} overScrollMode="never" onPageScroll={onPageScroll} onPageSelected={onPageSelected}>
          <View key="posts" collapsable={false} style={{ flex: 1 }}>{visited.has(0) ? renderPage("posts") : null}</View>
          <View key="apps" collapsable={false} style={{ flex: 1 }}>{visited.has(1) ? renderPage("apps") : null}</View>
        </AnimatedPagerView>
      )}
    </Root>
  );
}
