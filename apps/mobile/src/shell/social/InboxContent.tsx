import { View, ActivityIndicator } from "react-native";
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
import { readInbox, reconnectMessages, useInboxVersion, type InboxPage } from "./api";
import { SocialEmpty, SocialError } from "./SocialLayout";
export function InboxContent({ active, onMessage, drawerGesture }: { active: boolean; onMessage: (peer: PublicAuthor) => void; drawerGesture?: ReturnType<typeof Gesture.Pan> }) {
  const { colors } = useTheme();
  const version = useInboxVersion();
  const query = useSocialPage<InboxPage>({ name: "messages:inbox", authenticated: true, backgroundRefresh: true, active, version,
    empty: { conversations: [], unreadCount: 0, nextCursor: null }, read: readInbox,
    merge: (previous, next, more) => more ? { ...next, conversations: [...previous.conversations, ...next.conversations.filter(item => !previous.conversations.some(old => old.peer.id === item.peer.id))] } : next });
  const scrollY = useSharedValue(0), scroll = useAnimatedScrollHandler(e => { scrollY.value = e.contentOffset.y; });
  const refresh = usePullToRefresh({ scrollY, onRefresh: () => { reconnectMessages(); return query.load(); } });
  return <PullRefreshSurface refresh={refresh} drawerGesture={drawerGesture}><Animated.FlatList
    data={query.data.conversations} keyExtractor={item => item.peer.id} onScroll={scroll} scrollEventThrottle={16}
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
