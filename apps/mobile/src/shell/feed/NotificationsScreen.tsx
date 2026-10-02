import { useEffect, useRef, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
import FastImage from "@d11/react-native-fast-image";
import Toast from "react-native-toast-message";
import { PageHeader } from "../../../../../packages/ui/chrome";
import { Screen } from "../../../../../packages/ui/edge";
import { useTheme } from "../../../../../packages/ui/theme";
import { currentAccountId, useAccount } from "../account";
import { readShellValue, writeShellValue } from "../shellStorage";
import { markNotificationsRead, readNotifications, useNotificationCount, type Notice, type NoticePage } from "./notifications";
import { PullIndicator } from "./PullIndicator";
import { usePullToRefresh } from "./pullToRefresh";

export function NotificationsScreen({ onBack, onOpen }: { onBack: () => void; onOpen: (notice: Notice) => Promise<void> }) {
  const { colors } = useTheme(); const { user } = useAccount(); const count = useNotificationCount(); const focused = useIsFocused();
  const [page, setPage] = useState<NoticePage>({ notices: [], nextCursor: null, unreadCount: 0 }); const [loading, setLoading] = useState(false); const [acting, setActing] = useState(false); const [error, setError] = useState("");
  const alive = useRef(true); const revision = useRef(0); const reading = useRef(false); const writing = useRef(false); const firstCursor = useRef<string | null>(null); const loadedOwner = useRef<string | undefined>(undefined);
  const reload = useRef<() => Promise<void>>(async () => {}); const again = useRef(false);
  reload.current = () => load();
  const scrollY = useSharedValue(0); const onScroll = useAnimatedScrollHandler(event => { scrollY.value = event.contentOffset.y; });
  const { pull, phase, gesture, scrollGesture } = usePullToRefresh({ scrollY, onRefresh: () => load() }); const lift = useAnimatedStyle(() => ({ transform: [{ translateY: pull.value }] }));
  function remember(next: NoticePage) { setPage(next); if (user) writeShellValue(`social.notifications.${user.id}`, JSON.stringify({ ...next, notices: next.notices.slice(0, 50), nextCursor: firstCursor.current })); }
  async function load(more = false) {
    if (!user || writing.current || (more && !page.nextCursor)) return;
    if (reading.current) { if (!more) again.current = true; return; }
    reading.current = true; setLoading(true); const before = revision.current; const owner = user.id;
    try {
      if (!more && loadedOwner.current !== owner) { loadedOwner.current = owner; const raw = await readShellValue(`social.notifications.${owner}`); if (raw && alive.current && before === revision.current) { try { const cached = JSON.parse(raw); if (Array.isArray(cached.notices)) { firstCursor.current = cached.nextCursor; setPage(cached); } } catch {} } }
      const result = await readNotifications(more ? page.nextCursor! : undefined);
      if (!alive.current || before !== revision.current || await currentAccountId() !== owner) return;
      if (!more) firstCursor.current = result.nextCursor;
      setPage(previous => { const next = more ? { ...result, notices: [...previous.notices, ...result.notices.filter(item => !previous.notices.some(old => old.id === item.id))] } : result; writeShellValue(`social.notifications.${owner}`, JSON.stringify({ ...next, notices: next.notices.slice(0, 50), nextCursor: firstCursor.current })); return next; }); setError("");
    } catch (cause) { if (alive.current && before === revision.current) setError(cause instanceof Error ? cause.message : "通知暂时无法加载"); }
    finally { reading.current = false; if (alive.current) { setLoading(false); if (again.current) { again.current = false; void reload.current(); } } }
  }
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { revision.current++; setPage({ notices: [], nextCursor: null, unreadCount: 0 }); firstCursor.current = null; loadedOwner.current = undefined; }, [user?.id]);
  useEffect(() => { if (focused) void load(); }, [focused, user?.id]);
  async function act(notice?: Notice) {
    if (writing.current || !user) return; writing.current = true; setActing(true); revision.current++; const owner = user.id;
    try {
      const result = await markNotificationsRead(notice ? [notice.id] : undefined);
      if (!alive.current || await currentAccountId() !== owner) return;
      remember({ ...page, unreadCount: result.unreadCount, notices: page.notices.map(item => (!notice || item.id === notice.id) && item.createdAt <= result.before ? { ...item, read: true } : item) });
      if (notice) await onOpen(notice);
    } catch (cause) { if (alive.current) Toast.show({ type: "error", text1: "通知操作未完成", text2: cause instanceof Error ? cause.message : "请稍后重试" }); }
    finally { writing.current = false; if (alive.current) { setActing(false); if (reading.current) again.current = true; else if (!page.notices.length) void reload.current(); } }
  }
  return <Screen style={{ flex: 1, backgroundColor: colors.canvas }}><PageHeader title="通知" onBack={onBack} right={<Pressable disabled={acting || !count} onPress={() => void act()} style={{ padding: 10 }}><Text style={{ color: count ? colors.accent : colors.ink3, fontSize: 13 }}>全部已读</Text></Pressable>} /><GestureDetector gesture={gesture}><View style={{ flex: 1, overflow: "hidden" }}><PullIndicator pull={pull} phase={phase} /><Animated.View style={[{ flex: 1 }, lift]}><GestureDetector gesture={scrollGesture}><Animated.FlatList<Notice> data={user ? page.notices : []} keyExtractor={item => item.id} onScroll={onScroll} scrollEventThrottle={16} bounces={false} overScrollMode="never" scrollEnabled={phase !== "refreshing" && phase !== "done"} removeClippedSubviews={false}
    ListHeaderComponent={error ? <Pressable onPress={() => void load()} style={{ padding: 16 }}><Text style={{ color: colors.danger }}>{error} · 点击重试</Text></Pressable> : null}
    renderItem={({ item }) => <Pressable disabled={acting} accessibilityLabel={`${item.actor.name}${item.kind === "reply" ? "回复了你的评论" : "评论了你的动态"}${item.read ? "" : "，未读"}`} onPress={() => void act(item)} style={{ padding: 16, flexDirection: "row", gap: 12, borderBottomWidth: 0.5, borderBottomColor: colors.line, backgroundColor: item.read ? colors.canvas : colors.accentTint }}>{item.actor.avatarUrl ? <FastImage source={{ uri: item.actor.avatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} /> : <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.field, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.accent }}>{Array.from(item.actor.name)[0]}</Text></View>}<View style={{ flex: 1, gap: 6 }}><Text style={{ color: colors.ink1, fontSize: 14 }}><Text style={{ fontWeight: "700" }}>{item.actor.name}</Text>{item.kind === "reply" ? " 回复了你的评论" : " 评论了你的动态"}</Text><Text numberOfLines={3} style={{ color: colors.ink1, fontSize: 15, lineHeight: 22 }}>{item.body}</Text><Text numberOfLines={1} style={{ color: colors.ink3, fontSize: 12 }}>{item.postPreview}</Text><Text style={{ color: colors.ink3, fontSize: 11 }}>{new Date(item.createdAt).toLocaleString()}</Text></View>{!item.read ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, marginTop: 6 }} /> : null}</Pressable>}
    ListEmptyComponent={<View style={{ padding: 40, alignItems: "center" }}>{loading ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.ink3 }}>{user ? "还没有通知，收到评论和回复后会出现在这里" : "请登录后查看通知"}</Text>}</View>}
    ListFooterComponent={page.nextCursor ? <Pressable disabled={loading || acting} onPress={() => void load(true)} style={{ padding: 24 }}>{loading ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accent, textAlign: "center" }}>加载更多通知</Text>}</Pressable> : null} /></GestureDetector></Animated.View></View></GestureDetector></Screen>;
}
