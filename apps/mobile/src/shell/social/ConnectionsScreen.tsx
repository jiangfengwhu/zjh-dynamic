import { useEventCallback } from "../useEventCallback";
import { appendUnique } from "../listData";
import { AnimatedFlashList } from "../AnimatedFlashList";
import { useVisitedPager } from "../useVisitedPager";
import { memo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import PagerView, { type PagerViewOnPageScrollEvent, type PagerViewOnPageSelectedEvent } from "react-native-pager-view";
import Animated, { runOnJS, useEvent, useSharedValue, useAnimatedScrollHandler } from "react-native-reanimated";
import { Pressy } from "../../../../../packages/ui/chrome";
import { CompactTabs } from "../CompactTabs";
import { UserAvatar } from "../UserAvatar";
import { HostText as Text } from "../feed/HostText";
import { useTheme } from "../../../../../packages/ui/theme";
import { setAuthorFollow, type PublicAuthor } from "../feed/userPosts";
import { usePullToRefresh } from "../feed/pullToRefresh";
import { PullRefreshSurface } from "../feed/PullRefreshSurface";
import { useSocialPage } from "./useSocialPage";
import { readRelations, type RelationKind, type RelationPage } from "./api";
import { SocialEmpty, SocialError, SocialFrame } from "./SocialLayout";
import { cachedAccountId, requireAccount, useAccount } from "../account";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
const AnimatedPager = Animated.createAnimatedComponent(PagerView);
export function ConnectionsScreen({ author, initialKind, onBack, onAuthor }: {
  author: PublicAuthor; initialKind: RelationKind; onBack: () => void; onAuthor: (author: PublicAuthor) => void;
}) {
  const [kind, setKind] = useState(initialKind);
  const { user } = useAccount();
  const pager = useRef<PagerView>(null), initialIndex = useRef(initialKind === "following" ? 0 : 1);
  const { visited, visit, reveal } = useVisitedPager(initialIndex.current);
  const position = useSharedValue(initialIndex.current);
  const scroll = useEvent<PagerViewOnPageScrollEvent>(e => { "worklet"; reveal(e.position, e.offset); position.value = e.position + e.offset; }, ["onPageScroll"]);
  const selected = useEvent<PagerViewOnPageSelectedEvent>(e => { "worklet"; runOnJS(visit)(e.position); runOnJS(setKind)(e.position === 0 ? "following" : "followers"); }, ["onPageSelected"]);
  return <SocialFrame title={author.id === user?.id ? kind === "following" ? "我的关注" : "我的粉丝" : `${author.name}的${kind === "following" ? "关注" : "粉丝"}`} onBack={onBack}>
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><CompactTabs value={kind} position={position}
      options={[{ id: "following", label: "关注" }, { id: "followers", label: "粉丝" }]}
      onChange={next => pager.current?.setPage(next === "following" ? 0 : 1)} /></View>
    <AnimatedPager ref={pager} initialPage={initialIndex.current} style={{ flex: 1 }} offscreenPageLimit={1} onPageScroll={scroll} onPageSelected={selected}>
      {(["following", "followers"] as const).map(page => <View key={page} collapsable={false} style={{ flex: 1 }}>
        {visited.has(page === "following" ? 0 : 1) ? <ConnectionsList author={author} kind={page} active={kind === page} onAuthor={onAuthor} /> : null}
      </View>)}
    </AnimatedPager>
  </SocialFrame>;
}
function ConnectionsList({ author, kind, active, onAuthor }: { author: PublicAuthor; kind: RelationKind; active: boolean; onAuthor: (author: PublicAuthor) => void }) {
  const { colors } = useTheme();
  const query = useSocialPage<RelationPage>({ name: `connections:${author.id}:${kind}`, empty: { authors: [], nextCursor: null }, active,
    read: cursor => readRelations(author.id, kind, cursor),
    merge: (previous, next, more) => more ? { ...next, authors: appendUnique(previous.authors, next.authors, item => item.author.id) } : next });
  const [acting, setActing] = useState<string>();
  const locks = useRef(new Set<string>());
  const scrollY = useSharedValue(0), scroll = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });
  const refresh = usePullToRefresh({ scrollY, onRefresh: () => query.load() });
  const follow = useEventCallback(async (id: string, wanted: boolean) => {
    if (locks.current.has(id)) return;
    locks.current.add(id); setActing(id);
    try {
      if (!await requireAccount()) return;
      const owner = query.user?.id;
      const result = await setAuthorFollow(id, wanted);
      if (owner === cachedAccountId()) query.update(previous => ({...previous, authors: previous.authors.map(item => item.author.id === id ? {...item, following: result.following} : item)}));
    } catch (cause) { Toast.show({ type: "error", text1: "关注未完成", text2: cause instanceof Error ? cause.message : "请重试" }); }
    finally { locks.current.delete(id); setActing(undefined); }
  });
  return <PullRefreshSurface refresh={refresh}><AnimatedFlashList maintainVisibleContentPosition={{ disabled: true }}
    data={query.data.authors} keyExtractor={item => item.author.id} onScroll={scroll} scrollEventThrottle={16}
    showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={!query.data.authors.length ? { flexGrow: 1 } : undefined}
    ListHeaderComponent={<SocialError error={query.error} retry={() => { void query.load(); }} />}
    ListEmptyComponent={<SocialEmpty shape="person" loading={query.loading} loaded={query.loaded} text={kind === "following" ? "还没有关注的人" : "还没有粉丝"} />}
    renderItem={({ item }) => <RelationRow item={item} ownerId={query.user?.id} acting={acting === item.author.id} onAuthor={onAuthor} follow={follow} />}
    ListFooterComponent={query.data.nextCursor ? <Pressy accessibilityRole="button" onPress={() => { void query.load(true); }} disabled={query.loading} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
      {query.loading ? <ActivityIndicator color={colors.ink2} /> : <Text style={{ color: colors.ink2, fontWeight: "600" }}>加载更多</Text>}
    </Pressy> : null}
  /></PullRefreshSurface>;
}

const RelationRow = memo(function RelationRow({ item, ownerId, acting, onAuthor, follow }: { item: RelationPage["authors"][number]; ownerId?: string; acting: boolean; onAuthor: (author: PublicAuthor) => void; follow: (id: string, wanted: boolean) => Promise<void> }) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, borderBottomWidth: colors.components.surfaceBorder, borderBottomColor: colors.line }}>
      <Pressy accessibilityRole="button" accessibilityLabel={`查看${item.author.name}的主页`} onPress={() => onAuthor(item.author)} style={{ flex: 1, minWidth: 0, paddingVertical: 10, flexDirection: "row", gap: 10, alignItems: "center" }}>
        <UserAvatar uri={item.author.avatarUrl} authorId={item.author.id} size={40} />
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}><Text numberOfLines={1} style={{ color: colors.ink1, fontSize: 15, lineHeight: 20, letterSpacing: -0.2, fontWeight: "700" }}>{item.author.name}</Text>
          {item.followsYou ? <Text style={{ color: colors.ink3, fontSize: 12, lineHeight: 17 }}>{item.following ? "互相关注" : "关注了你"}</Text> : null}
        </View>
      </Pressy>
      {ownerId !== item.author.id ? <Pressy accessibilityRole="button" accessibilityLabel={item.following ? "取消关注" : "关注"} disabled={acting}
        onPress={() => { void follow(item.author.id, !item.following); }} style={{ minHeight: 30, height: 30, minWidth: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 0, backgroundColor: item.following ? colors.surfaceRaised : colors.accent, borderRadius: 15 }}>
        <Text style={{ color: item.following ? colors.ink2 : colors.onAccent, fontSize: 14, fontWeight: "700" }}>{acting ? "处理中" : item.following ? "已关注" : "关注"}</Text>
      </Pressy> : null}
    </View>;
});
