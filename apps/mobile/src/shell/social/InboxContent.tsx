import { useEffect, useRef } from "react";
import { View, ActivityIndicator, AppState, type ViewToken } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import type { Gesture } from "react-native-gesture-handler";
import { Pressy } from "../../../../../packages/ui/chrome";
import { useTheme } from "../../../../../packages/ui/theme";
import { PixelText as Text } from "../feed/PixelText";
import { UserAvatar } from "../UserAvatar";
import type { PublicAuthor } from "../feed/userPosts";
import { usePullToRefresh } from "../feed/pullToRefresh";
import { PullRefreshSurface } from "../feed/PullRefreshSurface";
import { useSocialPage } from "./useSocialPage";
import { markMessagesRead, readInbox, reconnectMessages, useInboxVersion, type InboxPage, type Conversation } from "./api";
import { cachedAccountId } from "../account";
import { SocialEmpty, SocialError } from "./SocialLayout";
export function InboxContent({ active, onMessage, drawerGesture }: { active: boolean; onMessage: (peer: PublicAuthor) => void; drawerGesture?: ReturnType<typeof Gesture.Pan> }) {
  const { colors } = useTheme();
  const version = useInboxVersion();
  const query = useSocialPage<InboxPage>({ name: "messages:inbox", authenticated: true, backgroundRefresh: true, active, version,
    empty: { conversations: [], unreadCount: 0, nextCursor: null }, read: readInbox,
    merge: (previous, next, more) => more ? { ...next, conversations: [...previous.conversations, ...next.conversations.filter(item => !previous.conversations.some(old => old.peer.id === item.peer.id))] } : next });
  const visible = useRef(new Set<string>()), seen = useRef(new Set<string>()), pending = useRef(new Set<string>());
  const alive = useRef(true), markVisible = useRef<() => void>(() => {});
  const viewabilityConfig = useRef({ minimumViewTime: 600, itemVisiblePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<Conversation>[] }) => {
    visible.current = new Set(viewableItems.filter(item => item.isViewable).map(item => item.item.peer.id));
    markVisible.current();
  }).current;
  markVisible.current = () => {
    const owner = query.user?.id;
    if (!query.focused || !owner || AppState.currentState !== "active") return;
    for (const item of query.data.conversations) {
      const key = `${owner}:${item.peer.id}:${item.lastMessage.id}`;
      if (!item.unreadCount || !visible.current.has(item.peer.id) || seen.current.has(key) || pending.current.has(key)) continue;
      pending.current.add(key);
      void markMessagesRead(item.peer.id, item.lastMessage.id).then(() => {
        if (!alive.current || cachedAccountId() !== owner) return;
        seen.current.add(key);
        query.update(previous => ({ ...previous, conversations: previous.conversations.map(current =>
          current.peer.id === item.peer.id && current.lastMessage.id === item.lastMessage.id ? { ...current, unreadCount: 0 } : current) }));
      }).catch(() => {}).finally(() => pending.current.delete(key));
    }
  };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { seen.current.clear(); visible.current.clear(); }, [query.user?.id]);
  useEffect(() => { markVisible.current(); }, [query.focused, query.data, query.user?.id]);
  const scrollY = useSharedValue(0), scroll = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });
  const refresh = usePullToRefresh({ scrollY, onRefresh: () => { reconnectMessages(); return query.load(); } });
  return <PullRefreshSurface refresh={refresh} drawerGesture={drawerGesture}><Animated.FlatList
    data={query.data.conversations} keyExtractor={item => item.peer.id} onScroll={scroll} scrollEventThrottle={16}
    viewabilityConfig={viewabilityConfig} onViewableItemsChanged={onViewableItemsChanged}
    showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never" contentContainerStyle={!query.data.conversations.length ? { flexGrow: 1 } : undefined}
    ListHeaderComponent={<SocialError error={query.error} retry={() => { reconnectMessages(); void query.load(); }} />}
    ListEmptyComponent={<SocialEmpty loading={query.loading} loaded={query.loaded} text="还没有私信，去作者主页聊聊吧" login={!query.user} />}
    renderItem={({ item }) => <Pressy accessibilityRole="button" accessibilityLabel={`与${item.peer.name}聊天${item.unreadCount ? `，${item.unreadCount}条未读` : ""}`} onPress={() => onMessage(item.peer)}
      style={{ flexDirection: "row", paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.line, backgroundColor: item.unreadCount ? colors.orchidTint : colors.canvas }}>
      <UserAvatar uri={item.peer.avatarUrl} authorId={item.peer.id} size={44} />
      <View style={{ flex: 1, gap: 5 }}><View style={{ flexDirection: "row", gap: 8 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 16, color: colors.ink1 }}>{item.peer.name}</Text>
        <Text style={{ fontSize: 11, color: colors.ink3 }}>{new Date(item.lastMessage.createdAt).toLocaleDateString()}</Text>
      </View><Text numberOfLines={2} style={{ color: colors.ink3, lineHeight: 20 }}>{item.lastMessage.senderId === query.user?.id ? "你：" : ""}{item.lastMessage.body}</Text></View>
      {item.unreadCount > 0 ? <View style={{ alignSelf: "center", minWidth: 22, padding: 4, borderRadius: 12, backgroundColor: colors.orchid }}><Text style={{ textAlign: "center", color: colors.onOrchid, fontSize: 11 }}>{item.unreadCount > 99 ? "99+" : item.unreadCount}</Text></View> : null}
    </Pressy>}
    ListFooterComponent={query.data.nextCursor ? <Pressy accessibilityRole="button" onPress={() => { void query.load(true); }} disabled={query.loading} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}>
      {query.loading ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accentText }}>加载更多会话</Text>}
    </Pressy> : null}
  /></PullRefreshSurface>;
}
