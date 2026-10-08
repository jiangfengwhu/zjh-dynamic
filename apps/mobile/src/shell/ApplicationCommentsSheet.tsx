import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Keyboard, View, type TextInput } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetTextInput, useBottomSheetScrollableCreator, useBottomSheetTimingConfigs, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ReduceMotion } from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { useTheme } from "../../../../packages/ui/theme";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { AnimatedFlashList, type FlashListRef } from "./AnimatedFlashList";
import { cachedAccountId, useAccount, requireAccount } from "./account";
import { HostAlert } from "./HostAlert";
import { PageSkeleton } from "./LoadingSkeleton";
import { UserAvatar } from "./UserAvatar";
import { HostText as Text } from "./feed/HostText";
import { cachedPostDetail, deletePostComment, fetchPostDetail, publishPostComment, type UserComment, type UserPost } from "./feed/userPosts";
import { formatWhen } from "./formatTime";
import { readShellValue, writeShellValue, removeShellValue } from "./shellStorage";

/** Work discussion stays over the playable stage; no timeline card or route change. */
export function ApplicationCommentsSheet({ post, active, onDismiss }: { post: UserPost; active: boolean; onDismiss: () => void }) {
  const { colors: t } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAccount();
  const initial = cachedPostDetail(post.id);
  const [comments, setComments] = useState<UserComment[]>(initial?.comments ?? []);
  const [count, setCount] = useState(initial?.post.commentCount ?? post.commentCount ?? 0);
  const [cursor, setCursor] = useState<string | null>(initial?.nextCursor ?? null);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [reply, setReply] = useState<UserComment | null>(null);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const modal = useRef<BottomSheetModal>(null);
  const input = useRef<TextInput>(null);
  const list = useRef<FlashListRef<UserComment>>(null);
  const alive = useRef(true);
  const reading = useRef(false);
  const writing = useRef(false);
  const loginAfterClose = useRef(false);
  const version = useRef(0);
  const loaded = useRef(!!initial);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const draftKey = `social.comment-draft.${user?.id ?? "guest"}.${post.id}`;
  const characters = Array.from(text).length;
  const Scrollable = useBottomSheetScrollableCreator();
  const animation = useBottomSheetTimingConfigs({ duration: 220 });
  const close = useCallback(() => { Keyboard.dismiss(); modal.current?.dismiss(); }, []);
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} pressBehavior="close" />, []);

  useEffect(() => {
    alive.current = true;
    modal.current?.present();
    const back = BackHandler.addEventListener("hardwareBackPress", () => { close(); return true; });
    return () => { alive.current = false; version.current++; back.remove(); modal.current?.dismiss(); };
  }, [close]);
  useEffect(() => { if (!active) close(); }, [active, close]);
  useEffect(() => {
    let live = true;
    setDraftReady(false);
    void (async () => {
      const value = await readShellValue(draftKey);
      const guestKey = `social.comment-draft.guest.${post.id}`;
      const guestDraft = !value && user ? await readShellValue(guestKey) : null;
      if (!live) return;
      if (guestDraft) { writeShellValue(draftKey, guestDraft); removeShellValue(guestKey); }
      setText(value || guestDraft || ""); setDraftReady(true);
    })().catch(() => {
      if (live) Toast.show({ type: "error", text1: "评论草稿读取失败，请重新打开评论" });
    });
    return () => { live = false; };
  }, [draftKey]);
  useEffect(() => { if (draftReady) { if (text) writeShellValue(draftKey, text); else removeShellValue(draftKey); } }, [draftReady, draftKey, text]);

  async function load(more = false) {
    if (reading.current || writing.current || (more && !cursor)) return;
    reading.current = true; setLoading(true);
    const before = version.current;
    try {
      const result = await fetchPostDetail(post.id, more ? cursor! : undefined);
      if (!alive.current || before !== version.current) return;
      loaded.current = true; setError(""); setCount(result.post.commentCount ?? 0); setCursor(result.nextCursor);
      setComments(prior => (more ? [...prior, ...result.comments.filter(item => !prior.some(old => old.id === item.id))] : result.comments).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)));
    } catch (cause) { if (alive.current && before === version.current) setError(cause instanceof Error ? cause.message : "评论加载失败，请重试"); }
    finally { reading.current = false; if (alive.current) { setLoading(false); if (before !== version.current && !writing.current) void load(); } }
  }
  useEffect(() => { void load(); }, []);

  async function send() {
    if (!draftReady || writing.current || !text.trim() || characters > 1000) return;
    writing.current = true; setSending(true); version.current++;
    try {
      if (!cachedAccountId()) { loginAfterClose.current = true; close(); return; }
      if (!await requireAccount() || !alive.current) return;
      const signature = JSON.stringify([text.trim(), reply?.id]);
      if (request.current?.signature !== signature) request.current = { signature, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` };
      const result = await publishPostComment(post.id, text.trim(), request.current.id, reply?.id);
      if (!alive.current) {
        if (await readShellValue(draftKey) === text) removeShellValue(draftKey);
        return;
      }
      setCount(result.post.commentCount ?? 0);
      setComments(prior => prior.some(item => item.id === result.comment.id) ? prior : [...prior, result.comment].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)));
      setText(""); setReply(null); request.current = null; input.current?.blur();
      requestAnimationFrame(() => { if (alive.current) list.current?.scrollToEnd({ animated: true }); });
    } catch (cause) { if (alive.current) Toast.show({ type: "error", text1: "评论未发送，内容已保留", text2: cause instanceof Error ? cause.message : "请重试" }); }
    finally { writing.current = false; if (alive.current) { setSending(false); if (!loaded.current && !reading.current) void load(); } }
  }
  function remove(comment: UserComment) {
    HostAlert.alert("删除评论？", "删除后无法恢复。", [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive", onPress: () => { void (async () => {
      if (writing.current || !alive.current) return;
      writing.current = true; version.current++; setDeleting(comment.id);
      try {
        const result = await deletePostComment(post.id, comment.id);
        if (alive.current) { setCount(result.post.commentCount ?? 0); setComments(prior => prior.filter(item => item.id !== comment.id)); if (reply?.id === comment.id) setReply(null); }
      } catch (cause) { if (alive.current) Toast.show({ type: "error", text1: "删除未完成", text2: cause instanceof Error ? cause.message : "请重试" }); }
      finally { writing.current = false; if (alive.current) setDeleting(null); }
    })(); } }]);
  }
  return <BottomSheetModal ref={modal} index={0} snapPoints={["68%", "92%"]} topInset={insets.top} enableDynamicSizing={false} enablePanDownToClose enableBlurKeyboardOnGesture keyboardBehavior="interactive" keyboardBlurBehavior="restore" android_keyboardInputMode="adjustResize" onDismiss={() => { onDismiss(); if (loginAfterClose.current) void requireAccount(); }} backdropComponent={backdrop} animationConfigs={animation} overrideReduceMotion={ReduceMotion.System} backgroundStyle={{ backgroundColor: t.canvas, borderTopLeftRadius: t.radius.xxl, borderTopRightRadius: t.radius.xxl }} handleIndicatorStyle={{ backgroundColor: t.lineStrong, width: 36 }}>
    <View style={{ flex: 1 }}>
      <View style={{ height: 40, paddingLeft: 48, paddingRight: 8, flexDirection: "row", alignItems: "center" }}>
        <Text accessibilityRole="header" style={{ flex: 1, textAlign: "center", color: t.ink1, fontSize: 14, fontWeight: "700" }}>{count} 条评论</Text>
        <Pressy accessibilityRole="button" accessibilityLabel="关闭作品评论" onPress={close} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><SymbolIcon name="close" color={t.ink2} /></Pressy>
      </View>
      <AnimatedFlashList ref={list} renderScrollComponent={Scrollable} data={comments} keyExtractor={item => item.id} maintainVisibleContentPosition={{ disabled: true }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} onEndReached={() => { if (cursor && !error) void load(true); }} onEndReachedThreshold={0.2}
        contentContainerStyle={!comments.length ? { flexGrow: 1 } : undefined}
        ListEmptyComponent={loading && !loaded.current ? <View style={{ padding: 16 }}><PageSkeleton rows={3} shape="comment" animated={active} /></View> : !error ? <View style={{ flex: 1, minHeight: 160, alignItems: "center", justifyContent: "center", padding: 24 }}><Text style={{ color: t.ink3 }}>还没有评论，来说点什么吧</Text></View> : null}
        renderItem={({ item }) => <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
          <UserAvatar uri={item.author.avatarUrl} authorId={item.author.id} size={32} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: t.ink3, fontSize: 12, lineHeight: 18 }}>{item.author.name}{item.author.id === post.author.id ? " · 作者" : ""}</Text>
            {item.replyTo ? <Text style={{ color: t.orchidText, fontSize: 12, lineHeight: 18 }}>回复 {item.replyTo.name}</Text> : null}
            <Text selectable style={{ color: t.ink1, fontSize: 14, lineHeight: 21 }}>{item.body}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ color: t.ink3, fontSize: 11 }}>{formatWhen(item.createdAt)}</Text>
              <Pressy accessibilityRole="button" accessibilityLabel={`回复${item.author.name}`} disabled={sending || !!deleting} onPress={() => { setReply(item); input.current?.focus(); }} style={{ minHeight: 32, justifyContent: "center" }}><Text style={{ color: t.ink2, fontSize: 12 }}>回复</Text></Pressy>
              {user?.id === item.author.id ? <Pressy accessibilityRole="button" accessibilityLabel="删除这条评论" disabled={sending || !!deleting} onPress={() => remove(item)} style={{ minHeight: 32, justifyContent: "center" }}><Text style={{ color: t.ink3, fontSize: 12 }}>删除</Text></Pressy> : null}
            </View>
          </View>
        </View>}
        ListFooterComponent={<View style={{ padding: 12 }}>{error ? <Pressy onPress={() => void load()} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: t.danger, textAlign: "center" }}>{error} · 点击重试</Text></Pressy> : loading && comments.length ? <ActivityIndicator color={t.ink3} /> : null}</View>} />
      <View style={{ borderTopWidth: t.components.surfaceBorder, borderTopColor: t.line, paddingHorizontal: 12, paddingTop: 8, paddingBottom: Math.max(12, insets.bottom), gap: 6 }}>
        {reply ? <Pressy disabled={sending} onPress={() => setReply(null)}><Text numberOfLines={1} style={{ color: t.orchidText, fontSize: 12 }}>回复 {reply.author.name} · 取消</Text></Pressy> : null}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <BottomSheetTextInput ref={input} value={text} onChangeText={setText} editable={draftReady && !sending} multiline maxLength={2000} placeholder="留下你的想法…" placeholderTextColor={t.ink3} style={{ flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 14, paddingVertical: 10, color: t.ink1, fontSize: 14, backgroundColor: t.surfaceRaised, borderRadius: t.radius.lg }} />
          <Pressy accessibilityRole="button" accessibilityLabel="发送评论" disabled={!draftReady || sending || !!deleting || !text.trim() || characters > 1000} onPress={() => void send()} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center", opacity: !text.trim() || characters > 1000 || !!deleting ? 0.4 : 1 }}>
            {sending ? <ActivityIndicator color={t.accent} /> : <SymbolIcon name="send" size={23} color={t.accent} />}
          </Pressy>
        </View>
        {characters > 800 ? <Text style={{ color: characters > 1000 ? t.danger : t.ink3, textAlign: "right", fontSize: 11 }}>{characters}/1000</Text> : null}
      </View>
    </View>
  </BottomSheetModal>;
}
