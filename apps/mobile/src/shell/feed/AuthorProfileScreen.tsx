import { useSyncExternalStore } from "react";
import { useEventCallback } from "../useEventCallback";
import type { MarketApplication } from "../market";
import { PageSkeleton } from "../LoadingSkeleton";
import { AnimatedFlashList, type FlashListRef } from "../AnimatedFlashList";
import { useVisitedPager } from "../useVisitedPager";
import { Text } from "../../../../../packages/ui/primitives/Typography";
import { UserAvatar } from "../UserAvatar";
import { EmptyState } from "../EmptyState";
import { ActivityIndicator } from "react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouteContentReady, useRouteRequestReady } from "../useRouteContentReady";
import { afterInteractions } from "../interactionWork";
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

import { cachedAccountId, useAccount, requireAccount, currentAccountId } from "../account";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { WorkCard } from "../WorkCard";
import { UserPostCard } from "./UserPostCard";
import { formatWhen } from "../formatTime";
import { usePullToRefresh } from "./pullToRefresh";
import { PullRefreshSurface } from "./PullRefreshSurface";
import {
  fetchAuthorProfile,
  cachedAuthorProfile,
  cachedAuthorFollowing,
  subscribeAuthorFollow,
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
  initialTab = "posts",
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
  initialTab?: "posts" | "apps";
  onBack?: () => void;
  embedded?: boolean;
  active?: boolean;
  drawerGesture?: ReturnType<typeof Gesture.Pan>;
  onPost: (post: UserPost) => void;
  onApplication: (appId: string, params?: import("../../../../../packages/app-sdk/src").ShareParams) => Promise<void>;
  onProfileLoaded?: (profile: AuthorProfile) => void;
  onConnections?: (author: PublicAuthor, kind: RelationKind) => void;
  onMessage?: (author: PublicAuthor) => void;
}) {
  const { colors } = useTheme();
  const { user } = useAccount();
  const timeline = useUserPosts("recommended", false);
  const contentReady = useRouteContentReady(embedded);
  const requestReady = useRouteRequestReady(embedded);
  const focused = useIsFocused() && active && requestReady;
  const [profile, setProfile] = useState<AuthorProfile>(() => cachedAuthorProfile(initialAuthor.id) ?? ({
    author: initialAuthor,
    posts: timeline.posts.filter((post) => post.author.id === initialAuthor.id),
    applications: [],
    nextCursor: null,
  }));
  const initialIndex = initialTab === "apps" ? 1 : 0;
  const { visited, visit, reveal } = useVisitedPager(initialIndex);
  const storedFollowing = useSyncExternalStore(subscribeAuthorFollow, () => cachedAuthorFollowing(initialAuthor.id));
  const following = storedFollowing ?? profile.following;
  const followUnknown = !!user && following === undefined;
  const [tab, setTab] = useState<"posts" | "apps">(initialTab);
  const loadedTabs = useRef(new Set<string>());
  const selectedTab = useRef(tab); selectedTab.current = tab;
  const previousTab = useRef(tab);
  const pager = useRef<PagerView>(null);
  const position = useSharedValue(initialIndex);
  const appY = useSharedValue(0);
  const appList = useAnimatedRef<FlashListRef<ProfileRow>>();
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
    setFollowBusy(true);
    let owner = cachedAccountId();
    try {
      if (!(await requireAccount())) return;
      owner = await currentAccountId();
      if (!alive.current || owner === initialAuthor.id) return;
      revision.current++;
      if (reading.current) rerun.current = true;
      const result = await setAuthorFollow(
        initialAuthor.id,
        !following,
      );
      const currentOwner = await currentAccountId();
      if (!alive.current || currentOwner !== owner) return;
      revision.current++;
      if (reading.current) rerun.current = true;
      setProfile((previous) => ({ ...previous, ...result }));
    } catch (cause) {
      if (alive.current && cachedAccountId() === owner)
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
  const load = useEventCallback(async (more = false): Promise<boolean> => {
    if (!alive.current || !focused) return false;
    if (reading.current) {
      if (!more) rerun.current = true;
      return false;
    }
    const target = selectedTab.current;
    const cursor = target === "posts" ? profile.nextCursor : profile.applicationsNextCursor;
    if (more && !cursor) return false;
    reading.current = true; setBusy(true);
    const before = revision.current;
    const owner = cachedAccountId();
    try {
      const result = await fetchAuthorProfile(initialAuthor.id, target, more ? cursor! : undefined);
      if (!alive.current || before !== revision.current || cachedAccountId() !== owner) return false;
      onProfileLoaded?.(result);
      setProfile(previous => ({ ...previous, ...result,
        posts: target === "posts" ? result.posts : previous.posts,
        nextCursor: target === "posts" ? result.nextCursor : previous.nextCursor,
        applications: target === "apps" ? result.applications : previous.applications,
        applicationsNextCursor: target === "apps" ? result.applicationsNextCursor : previous.applicationsNextCursor,
      }));
      loadedTabs.current.add(target);
      setLoaded(true);
      setError("");
      return true;
    } catch (cause) {
      if (alive.current && before === revision.current && cachedAccountId() === owner)
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
  });
  useEffect(
    () => {
      alive.current = true;
      return () => { alive.current = false; revision.current++; };
    },
    [],
  );
  useEffect(() => {
    revision.current++;
    if (identity.current !== user?.id) {
      identity.current = user?.id;
      setProfile(cachedAuthorProfile(initialAuthor.id) ?? { author: initialAuthor, posts: [], applications: [], nextCursor: null });
      loadedTabs.current.clear();
      setLoaded(false);
    }
    if (!focused) return;
    return afterInteractions(() => { void load(false); });
  }, [focused, user?.id, load]);
  useEffect(() => {
    if (previousTab.current === tab) return;
    previousTab.current = tab;
    revision.current++;
    if (!focused || loadedTabs.current.has(tab)) return;
    return afterInteractions(() => { void load(false); });
  }, [tab, focused, load]);
  const updated = useCallback((post: UserPost) => {
    revision.current++;
    if (reading.current) rerun.current = true;
    setProfile((previous) => ({
      ...previous,
      posts: previous.posts.map((item) => (item.id === post.id ? post : item)),
    }));
  }, []);
  const deleted = useCallback((id: string) => {
    revision.current++;
    if (reading.current) rerun.current = true;
    setProfile((previous) => ({
      ...previous,
      posts: previous.posts.filter((post) => post.id !== id),
    }));
  }, []);
  const author = useMemo(() => profile.author.id === user?.id
      ? { ...profile.author, name: user.name, avatarUrl: user.avatarUrl }
      : profile.author, [profile.author, user?.id, user?.name, user?.avatarUrl]);
  const Root = embedded ? View : Screen;
  const header = (
    <View>
      {!embedded ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ borderRadius: 32, padding: 2, experimental_backgroundImage: colors.aurora }}>
              <View style={{ borderRadius: 30, padding: 2, backgroundColor: colors.canvas }}>
                <UserAvatar uri={author.avatarUrl} authorId={author.id} size={56} />
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <Text
                numberOfLines={2}
                style={{
                  ...colors.type.title2,
                  color: colors.ink1,
                }}
              >
                {author.name}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {author.official ? (
                  <Text style={{ fontSize: 11, lineHeight: 15, fontWeight: "700", letterSpacing: 0.3, color: colors.orchidText, backgroundColor: colors.orchidTint, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: "hidden" }}>
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
                    ? `${profile.applicationCount ?? profile.applications.length} 个公开应用`
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
                accessibilityLabel={following ? "取消关注" : "关注作者"}
                accessibilityState={{
                  disabled: followBusy || followUnknown,
                  selected: !!following,
                }}
                disabled={followBusy || followUnknown}
                onPress={() => void toggleFollow()}
                style={{
                  minHeight: 34,
                  minWidth: 64,
                  paddingHorizontal: 14,
                  borderRadius: 17,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: following || followUnknown
                    ? colors.surfaceRaised
                    : colors.accent,
                  opacity: followBusy || followUnknown ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    letterSpacing: -0.1,
                    color: following || followUnknown ? colors.ink2 : colors.onAccent,
                  }}
                >
                  {followBusy
                    ? "处理中…"
                    : followUnknown
                      ? "—"
                      : following
                      ? "已关注"
                      : "关注"}
                </Text>
              </Pressable>
            ) : null}
            {onMessage && user?.id !== author.id ? <Pressable accessibilityRole="button" accessibilityLabel={`给${author.name}发私信`} onPress={() => onMessage(author)}
              style={{ minHeight: 34, minWidth: 52, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceRaised, borderRadius: 17 }}>
              <Text style={{ color: colors.ink1, fontSize: 13, fontWeight: "700" }}>私信</Text>
            </Pressable> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 20 }}>
            {(["following", "followers"] as const).map(kind => <Pressable key={kind} accessibilityRole="button" accessibilityLabel={kind === "following" ? "查看关注" : "查看粉丝"} disabled={!onConnections}
              onPress={() => onConnections?.(author, kind)} style={{ minHeight: 28, justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: colors.ink3 }}><Text style={{ fontSize: 15, fontWeight: "800", letterSpacing: -0.3, color: colors.ink1 }}>{loaded ? (kind === "following" ? profile.followingCount ?? 0 : profile.followerCount ?? 0) : "—"}</Text> {kind === "following" ? "关注" : "粉丝"}</Text>
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
  const postRows = useMemo(() => profile.posts.map(post => ({ type: "post" as const, post })), [profile.posts]);
  const appRows = useMemo(() => profile.applications.map(app => ({ type: "app" as const, app })), [profile.applications]);
  const renderPage = (tab: "posts" | "apps") => {
    const refresh = tab === "posts" ? postsRefresh : appsRefresh;
    return <PullRefreshSurface refresh={refresh} drawerGesture={drawerGesture} top={profileScroll.refreshOffset}>
              <AnimatedFlashList<ProfileRow> maintainVisibleContentPosition={{ disabled: true }}
                ref={tab === "posts" ? list : appList}
                data={!contentReady && !loaded ? [] : tab === "posts" ? postRows : appRows}
                getItemType={row => row.type}
                keyExtractor={(row) =>
                  row.type === "post" ? row.post.id : row.app.manifest.appId
                }
                onScroll={tab === "posts" ? profileScroll.onScroll : appScroll}
                onLayout={tab === "posts" ? profileScroll.onLayout : undefined}
                onContentSizeChange={tab === "posts" ? profileScroll.onContentSizeChange : undefined}
                contentContainerStyle={[tab === "posts" ? profileScroll.contentStyle : undefined, !(tab === "posts" ? profile.posts.length : profile.applications.length) && (tab === "posts" ? profileScroll.emptyContentStyle : { flexGrow: 1 })]}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                overScrollMode="never"
                bounces={false}
                scrollEnabled={refresh.phase !== "refreshing" && refresh.phase !== "done"}
                renderItem={({ item: row, index }) => row.type === "app"
                  ? <AuthorApplicationRow item={row.app} author={author} index={index} onApplication={onApplication} />
                  : <AuthorPostRow item={row.post} author={author} own={user?.id === row.post.author.id} onPost={onPost} onApplication={onApplication} onUpdated={updated} onDeleted={deleted} />}
                ListEmptyComponent={
                  loadedTabs.current.has(tab) && !error ? (
                    <EmptyState><Text
                      style={{
                        textAlign: "center",
                        padding: 16,
                        color: colors.ink3,
                      }}
                    >
                      {tab === "apps" ? "还没有公开作品" : "还没有公开动态"}
                    </Text></EmptyState>
                  ) : !loadedTabs.current.has(tab) && !error ? (
                    <PageSkeleton rows={3} shape={tab === "apps" ? "work" : "feed"} inset={tab === "apps" ? 12 : 16} />
                  ) : null
                }
                ListFooterComponent={
                  <View style={{ padding: loadedTabs.current.has(tab) && (tab === "posts" ? profile.nextCursor : profile.applicationsNextCursor) ? 16 : 0 }}>
                    {loadedTabs.current.has(tab) && (tab === "posts" ? profile.nextCursor : profile.applicationsNextCursor) ? (
                      <Pressable
                        disabled={busy}
                        onPress={() => void load(true)}
                        style={{ padding: 14 }}
                      >
                        {busy ? (
                          <ActivityIndicator color={colors.ink2} />
                        ) : (
                          <Text
                            style={{
                              textAlign: "center",
                              color: colors.ink2,
                              fontWeight: "600",
                            }}
                          >
                            加载更多
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
    <Root style={{ flex: 1, backgroundColor: embedded ? "transparent" : colors.canvas }}>
      {!embedded ? (
        <PageHeader title="作者主页" onBack={onBack} />
      ) : null}
      {header}
      {!contentReady ? <View style={{ flex: 1 }} /> : embedded ? renderPage("posts") : (
        <AnimatedPagerView ref={pager} initialPage={initialIndex} style={{ flex: 1 }} offscreenPageLimit={1} overScrollMode="never" onPageScroll={onPageScroll} onPageSelected={onPageSelected}>
          <View key="posts" collapsable={false} style={{ flex: 1 }}>{visited.has(0) ? renderPage("posts") : null}</View>
          <View key="apps" collapsable={false} style={{ flex: 1 }}>{visited.has(1) ? renderPage("apps") : null}</View>
        </AnimatedPagerView>
      )}
    </Root>
  );
}

const AuthorApplicationRow = memo(function AuthorApplicationRow({ item, author, index, onApplication }: { item: MarketApplication; author: PublicAuthor; index: number; onApplication: (id: string) => Promise<void> }) {
  const open = useCallback(() => { void onApplication(item.manifest.appId); }, [onApplication, item.manifest.appId]);
  return <View style={{ paddingHorizontal: 12, paddingBottom: 12 }}><WorkCard application={item} title={item.title || item.manifest.appName} summary={item.summary ?? item.manifest.description} authorName={author.name} authorAvatarUrl={author.avatarUrl} visibility="public" tone={index} onOpen={open} /></View>;
});
const AuthorPostRow = memo(function AuthorPostRow({ item, author, own, onPost, onApplication, onUpdated, onDeleted }: { item: UserPost; author: PublicAuthor; own: boolean; onPost: (post: UserPost) => void; onApplication: (id: string) => Promise<void>; onUpdated: (post: UserPost) => void; onDeleted: (id: string) => void }) {
  const { colors } = useTheme();
  const post = useMemo(() => ({ ...item, author }), [item, author]);
  const open = useCallback(() => onPost(item), [onPost, item]);
  const remove = useCallback(() => onDeleted(item.id), [onDeleted, item.id]);
  return <View style={{ borderBottomWidth: colors.components.surfaceBorder, borderBottomColor: colors.line }}><UserPostCard post={post} time={formatWhen(item.createdAt)} own={own} onOpen={open} onApplication={onApplication} onUpdated={onUpdated} onDeleted={remove} /></View>;
});
