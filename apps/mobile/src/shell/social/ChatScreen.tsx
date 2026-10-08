import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import Animated, { useAnimatedScrollHandler, useSharedValue, runOnJS } from "react-native-reanimated";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { Pressy } from "../../../../../packages/ui/chrome";
import { KeyboardViewport } from "../KeyboardViewport";
import { FormField } from "../FormField";
import { UserAvatar } from "../UserAvatar";
import { HostText as Text } from "../feed/HostText";
import { useTheme } from "../../../../../packages/ui/theme";
import type { PublicAuthor } from "../feed/userPosts";
import { readShellValue, writeShellValue, removeShellValue } from "../shellStorage";
import { cachedAccountId, requireAccount } from "../account";
import { usePullToRefresh } from "../feed/pullToRefresh";
import { PullRefreshSurface } from "../feed/PullRefreshSurface";
import { useSocialPage } from "./useSocialPage";
import { markMessagesRead, readMessages, reconnectMessages, sendMessage, useInboxVersion, type Message, type MessagePage } from "./api";
import { SocialEmpty, SocialError, SocialFrame } from "./SocialLayout";
import { formatWhen } from "../formatTime";

export function ChatScreen({ peer, onBack }: { peer: PublicAuthor; onBack: () => void }) {
  const { colors } = useTheme();
  const version = useInboxVersion(true);
  const query = useSocialPage<MessagePage>({ name: `messages:thread:${peer.id}`, authenticated: true, version,
    empty: { peer, messages: [], nextCursor: null }, read: cursor => readMessages(peer.id, cursor),
    merge: (previous, next, more) => {
      const messages = [...new Map([...previous.messages, ...next.messages].map(message => [message.id, message])).values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
      return { ...next, messages, nextCursor: more ? next.nextCursor : messages.length > next.messages.length ? previous.nextCursor : next.nextCursor };
    } });
  const [text, setText] = useState(""), [sending, setSending] = useState(false), [draftReady, setDraftReady] = useState(false);
  const draftKey = `social.message-draft.${query.user?.id ?? "guest"}.${peer.id}`;
  const sendingRef = useRef(false), alive = useRef(true), list = useRef<FlatList<Message>>(null), atBottom = useRef(true);
  const request = useRef<{ body: string; id: string } | undefined>(undefined);
  const loadedDraftKey = useRef<string | undefined>(undefined);
  const ownerRef = useRef(query.user?.id); ownerRef.current = query.user?.id;
  const scrollY = useSharedValue(0);
  const recordBottom = (bottom: boolean) => { atBottom.current = bottom; };
  const scroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y;
    runOnJS(recordBottom)(e.contentSize.height - e.layoutMeasurement.height - e.contentOffset.y < 80);
  });
  const refresh = usePullToRefresh({ scrollY, onRefresh: () => { reconnectMessages(); return query.load(); } });
  usePreventRemove(sending, () => Toast.show({ type: "info", text1: "正在发送，请稍候" }));
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    let live = true;
    loadedDraftKey.current = undefined; setDraftReady(false); setText(""); request.current = undefined;
    void readShellValue(draftKey).then(raw => { if (live) { loadedDraftKey.current = draftKey; setText(raw ?? ""); setDraftReady(true); } }, () => { if (live) { loadedDraftKey.current = draftKey; setDraftReady(true); Toast.show({ type: "error", text1: "私信草稿读取失败" }); } });
    return () => { live = false; };
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady || loadedDraftKey.current !== draftKey) return;
    if (text) writeShellValue(draftKey, text); else removeShellValue(draftKey);
  }, [draftKey, draftReady, text]);
  useEffect(() => {
    const last = query.data.messages.at(-1);
    if (query.focused && last && query.user) void markMessagesRead(peer.id, last.id).catch(() => {});
  }, [query.focused, query.data, query.user?.id, peer.id]);
  async function send() {
    const body = text.trim(), owner = query.user?.id;
    if (sendingRef.current || !draftReady || !body || Array.from(body).length > 2000 || !owner) return;
    sendingRef.current = true; setSending(true);
    if (request.current?.body !== body) request.current = { body, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` };
    try {
      const result = await sendMessage(peer.id, body, request.current.id);
      if (!alive.current || ownerRef.current !== owner || cachedAccountId() !== owner) return;
      atBottom.current = true;
      query.update(previous => ({ ...previous, messages: [...new Map([...previous.messages, result.message].map(message => [message.id, message])).values()].sort((a, b) => a.createdAt - b.createdAt) }));
      setText(""); removeShellValue(draftKey); request.current = undefined;
    } catch (cause) { if (alive.current && ownerRef.current === owner) Toast.show({ type: "error", text1: "发送未完成，内容已保留", text2: cause instanceof Error ? cause.message : "请重试" }); }
    finally { sendingRef.current = false; if (alive.current) setSending(false); }
  }
  const count = Array.from(text).length;
  return <SocialFrame title={query.data.peer.name || peer.name} onBack={onBack}><KeyboardViewport backgroundColor={colors.canvas}>
    <PullRefreshSurface refresh={refresh}><Animated.FlatList<Message>
      ref={list} data={query.data.messages} keyExtractor={item => item.id} onScroll={scroll} scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never"
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 14, ...(!query.data.messages.length ? { flexGrow: 1 } : {}) }}
      onContentSizeChange={() => { if (atBottom.current) requestAnimationFrame(() => list.current?.scrollToEnd({ animated: false })); }}
      ListHeaderComponent={<View><SocialError error={query.error} retry={() => { reconnectMessages(); void query.load(); }} />
        {query.data.nextCursor ? <Pressy accessibilityRole="button" disabled={query.loading} onPress={() => { atBottom.current = false; void query.load(true); }} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
          {query.loading ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accentText }}>查看更早的消息</Text>}
        </Pressy> : null}
      </View>}
      ListEmptyComponent={<SocialEmpty loading={query.loading} loaded={query.loaded} text="说声你好，开始聊天吧" login={!query.user} />}
      renderItem={({ item }) => {
        const mine = item.senderId === query.user?.id;
        return <View style={{ flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-start", gap: 8 }}>
          <UserAvatar uri={mine ? query.user?.avatarUrl : query.data.peer.avatarUrl} authorId={item.senderId} size={32} />
          <View style={{ maxWidth: "80%", gap: 4, alignItems: mine ? "flex-end" : "flex-start" }}>
            <View style={{ backgroundColor: mine ? colors.accent : colors.surface, borderRadius: 20, borderTopRightRadius: mine ? 6 : 20, borderTopLeftRadius: mine ? 20 : 6, paddingHorizontal: 14, paddingVertical: 10 }}><Text selectable style={{ color: mine ? colors.onAccent : colors.ink1, fontSize: 15, lineHeight: 22 }}>{item.body}</Text></View>
            <Text style={{ color: colors.ink3, fontSize: 11, paddingHorizontal: 4 }}>{formatWhen(item.createdAt)}</Text>
          </View>
        </View>;
      }}
    /></PullRefreshSurface>
    {query.user ? <View style={{ paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderTopWidth: colors.components.surfaceBorder, borderTopColor: colors.line }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <FormField accessibilityLabel="私信内容" value={text} onChangeText={setText} editable={draftReady && !sending} multiline maxLength={4000} placeholder="写一条私信…" placeholderTextColor={colors.ink3}
          style={{ flex: 1, minHeight: 44, maxHeight: 140, paddingHorizontal: 16, paddingVertical: 11, color: colors.ink1, fontSize: 15, backgroundColor: colors.surface, borderWidth: colors.components.surfaceBorder, borderColor: colors.line, borderRadius: 22 }} />
        <Pressy accessibilityRole="button" accessibilityLabel="发送私信" disabled={sending || !draftReady || !text.trim() || count > 2000} onPress={() => { void send(); }}
          style={{ minHeight: 44, minWidth: 64, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderRadius: 22, opacity: !text.trim() || count > 2000 ? 0.45 : 1 }}>
          {sending ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: "700" }}>发送</Text>}
        </Pressy>
      </View>{count > 1600 ? <Text style={{ color: count > 2000 ? colors.danger : colors.ink3, textAlign: "right", fontSize: 11 }}>{count}/2000</Text> : null}
    </View> : <Pressy accessibilityRole="button" onPress={() => { void requireAccount(); }} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.accentText }}>登录后发送私信</Text></Pressy>}
  </KeyboardViewport></SocialFrame>;
}
