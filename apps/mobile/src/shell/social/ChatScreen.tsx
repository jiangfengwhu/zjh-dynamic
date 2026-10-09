import { ApplicationPostCard } from "../feed/ApplicationPostCard";
import { openPublicMarketApplication } from "../navigation";
import { DraftInputScope, useDraftText, useDraftPersistence } from "../DraftInputScope";
import { mergeChronological } from "../listData";
import { AnimatedFlashList, type FlashListRef } from "../AnimatedFlashList";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View, type LayoutChangeEvent } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import { useAnimatedScrollHandler, useSharedValue, runOnJS } from "react-native-reanimated";
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
  const version = useInboxVersion(true, peer.id);
  const latestMessage = useRef<string | undefined>(undefined);
  const threadOwner = useRef(cachedAccountId());
  if (threadOwner.current !== cachedAccountId()) {threadOwner.current = cachedAccountId(); latestMessage.current = undefined;}
  const query = useSocialPage<MessagePage>({ name: `messages:thread:${peer.id}`, authenticated: true, version,
    empty: { peer, messages: [], nextCursor: null }, read: cursor => readMessages(peer.id, cursor, cursor ? undefined : latestMessage.current),
    merge: (previous, next, more) => {
      const messages = mergeChronological(previous.messages, next.messages);
      return { ...next, messages, nextCursor: more ? next.nextCursor : messages.length > next.messages.length ? previous.nextCursor : next.nextCursor };
    } });
  latestMessage.current = query.data.messages.at(-1)?.id;
  const draft = useDraftText(); const setText = draft.setText;
  const [sending, setSending] = useState(false), [draftReady, setDraftReady] = useState(false);
  const draftKey = `social.message-draft.${query.user?.id ?? "guest"}.${peer.id}`;
  const sendingRef = useRef(false), alive = useRef(true), list = useRef<FlashListRef<Message>>(null), atBottom = useRef(true);
  const request = useRef<{ body: string; id: string } | undefined>(undefined);
  const loadedDraftKey = useRef<string | undefined>(undefined);
  const ownerRef = useRef(query.user?.id); ownerRef.current = query.user?.id;
  const scrollY = useSharedValue(0);
  const recordBottom = (bottom: boolean) => { atBottom.current = bottom; };
  const bottomUI = useSharedValue(true);
  const userScrolling = useSharedValue(false);
  const viewportHeight = useRef(0), bottomFrame = useRef<number | undefined>(undefined);
  const followBottom = useCallback(() => {
    if (!atBottom.current) return;
    if (bottomFrame.current !== undefined) cancelAnimationFrame(bottomFrame.current);
    bottomFrame.current = requestAnimationFrame(() => {
      bottomFrame.current = undefined;
      if (alive.current && atBottom.current) list.current?.scrollToEnd({ animated: false });
    });
  }, []);
  const layout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height;
    if (height === viewportHeight.current) return;
    viewportHeight.current = height;
    followBottom();
  }, [followBottom]);
  useEffect(() => () => {
    if (bottomFrame.current !== undefined) cancelAnimationFrame(bottomFrame.current);
  }, []);
  const scroll = useAnimatedScrollHandler({
    onBeginDrag: e => {
      userScrolling.value = true;
      const bottom = e.contentSize.height - e.layoutMeasurement.height - e.contentOffset.y < 80;
      bottomUI.value = bottom;
      runOnJS(recordBottom)(bottom);
    },
    onScroll: e => {
      scrollY.value = e.contentOffset.y;
      // Resizing for the keyboard or composer must not change the user's intent.
      if (!userScrolling.value) return;
      const bottom = e.contentSize.height - e.layoutMeasurement.height - e.contentOffset.y < 80;
      if (bottom !== bottomUI.value) { bottomUI.value = bottom; runOnJS(recordBottom)(bottom); }
    },
    onEndDrag: () => { userScrolling.value = false; },
    onMomentumBegin: () => { userScrolling.value = true; },
    onMomentumEnd: () => { userScrolling.value = false; },
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
  useDraftPersistence(draft, draftKey, draftReady);
  const [visibleThrough, setVisibleThrough] = useState<string>();
  const acknowledged = useRef<string | undefined>(undefined);
  useEffect(() => { acknowledged.current = undefined; setVisibleThrough(undefined); }, [query.user?.id, peer.id]);
  useEffect(() => {
    if (!query.focused || !query.user || !visibleThrough || acknowledged.current === visibleThrough) return;
    const owner = query.user.id;
    acknowledged.current = visibleThrough;
    void markMessagesRead(peer.id, visibleThrough).catch(() => { if (cachedAccountId() === owner && acknowledged.current === visibleThrough) acknowledged.current = undefined; });
  }, [query.focused, visibleThrough, query.user?.id, peer.id]);
  async function send() {
    const body = draft.text.trim(), owner = query.user?.id;
    if (sendingRef.current || !draftReady || !body || Array.from(body).length > 2000 || !owner) return;
    sendingRef.current = true; setSending(true);
    if (request.current?.body !== body) request.current = { body, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` };
    try {
      const result = await sendMessage(peer.id, body, request.current.id);
      if (!alive.current || ownerRef.current !== owner || cachedAccountId() !== owner) return;
      atBottom.current = true;
      query.update(previous => ({ ...previous, messages: mergeChronological(previous.messages, [result.message]) }));
      setText(""); removeShellValue(draftKey); request.current = undefined;
    } catch (cause) { if (alive.current && ownerRef.current === owner) Toast.show({ type: "error", text1: "发送未完成，内容已保留", text2: cause instanceof Error ? cause.message : "请重试" }); }
    finally { sendingRef.current = false; if (alive.current) setSending(false); }
  }

  return <SocialFrame title={query.data.peer.name || peer.name} onBack={onBack}><KeyboardViewport>
    <PullRefreshSurface refresh={refresh}><AnimatedFlashList<Message>
      ref={list} onLayout={layout} data={query.data.messages} keyExtractor={item => item.id} onScroll={scroll} scrollEventThrottle={16}
      viewabilityConfig={{itemVisiblePercentThreshold: 60, minimumViewTime: 200}}
      onViewableItemsChanged={({viewableItems}) => {
        let visible: Message | undefined;
        for (const token of viewableItems) if (token.isViewable && token.item.senderId !== query.user?.id && (!visible || token.item.createdAt > visible.createdAt || token.item.createdAt === visible.createdAt && token.item.id > visible.id)) visible = token.item;
        if (visible) setVisibleThrough(visible.id);
      }}
      keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} overScrollMode="never"
      maintainVisibleContentPosition={{ startRenderingFromBottom: true }}
      contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, ...(!query.data.messages.length ? { flexGrow: 1 } : {}) }}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      onContentSizeChange={followBottom}
      ListHeaderComponent={<View><SocialError error={query.error} retry={() => { reconnectMessages(); void query.load(); }} />
        {query.data.nextCursor ? <Pressy accessibilityRole="button" disabled={query.loading} onPress={() => { atBottom.current = false; void query.load(true); }} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
          {query.loading ? <ActivityIndicator color={colors.ink2} /> : <Text style={{ color: colors.ink3, fontSize: 13, fontWeight: "600" }}>查看更早的消息</Text>}
        </Pressy> : null}
      </View>}
      ListEmptyComponent={<SocialEmpty shape="chat" inset={0} loading={query.loading} loaded={query.loaded} text="说声你好，开始聊天吧" login={!query.user} />}
      renderItem={({ item }) => {
        const mine = item.senderId === query.user?.id;
        return <View style={{ flexDirection: mine ? "row-reverse" : "row", alignItems: "flex-start", gap: 8 }}>
          <UserAvatar uri={mine ? query.user?.avatarUrl : query.data.peer.avatarUrl} authorId={item.senderId} size={26} />
          <View style={{ maxWidth: "78%", gap: 5, alignItems: mine ? "flex-end" : "flex-start" }}>
            {item.application ? <View style={{ width: 260, maxWidth: "100%" }}><ApplicationPostCard application={item.application} onOpen={openPublicMarketApplication} /></View> : null}
            {item.body ? <View style={{ backgroundColor: mine ? colors.accent : colors.surface, borderRadius: 18, borderTopRightRadius: mine ? 6 : 18, borderTopLeftRadius: mine ? 18 : 6, paddingHorizontal: 12, paddingVertical: 8, boxShadow: mine ? undefined : colors.shadow.card, borderWidth: !mine && colors.mode === "dark" ? colors.components.surfaceBorder : 0, borderColor: colors.line }}><Text selectable style={{ color: mine ? colors.onAccent : colors.ink1, fontSize: 14, lineHeight: 20 }}>{item.body}</Text></View> : null}
            <Text style={{ color: colors.ink3, fontSize: 11, letterSpacing: 0.2, paddingHorizontal: 6 }}>{formatWhen(item.createdAt)}</Text>
          </View>
        </View>;
      }}
    /></PullRefreshSurface>
    {query.user ? <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 12, gap: 6, borderTopWidth: colors.components.surfaceBorder, borderTopColor: colors.line }}>
      <DraftInputScope draft={draft}>{(text, setText, count) => <><View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        <FormField accessibilityLabel="私信内容" value={text} onChangeText={setText} editable={draftReady && !sending} multiline maxLength={4000} placeholder="写一条私信…" placeholderTextColor={colors.ink3}
          style={{ flex: 1, minHeight: 38, maxHeight: 140, paddingHorizontal: 14, paddingVertical: 8, color: colors.ink1, fontSize: 14, backgroundColor: colors.surfaceRaised, borderRadius: 19 }} />
        <Pressy accessibilityRole="button" accessibilityLabel="发送私信" disabled={sending || !draftReady || !text.trim() || count > 2000} onPress={() => { void send(); }}
          style={{ minHeight: 38, minWidth: 60, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.accent, borderRadius: 19, opacity: !text.trim() || count > 2000 ? 0.35 : 1 }}>
          {sending ? <ActivityIndicator color={colors.onAccent} /> : <Text style={{ color: colors.onAccent, fontWeight: "700" }}>发送</Text>}
        </Pressy>
      </View>{count > 1600 ? <Text style={{ color: count > 2000 ? colors.danger : colors.ink3, textAlign: "right", fontSize: 11 }}>{count}/2000</Text> : null}</>}</DraftInputScope>
    </View> : <Pressy accessibilityRole="button" onPress={() => { void requireAccount(); }} style={{ minHeight: 42, margin: 12, borderRadius: 21, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.onAccent, fontWeight: "700" }}>登录后发送私信</Text></Pressy>}
  </KeyboardViewport></SocialFrame>;
}
