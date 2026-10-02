import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import FastImage from "@d11/react-native-fast-image";
import Clipboard from "@react-native-clipboard/clipboard";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";
import { PageHeader } from "../../../../../packages/ui/chrome";
import { Screen } from "../../../../../packages/ui/edge";
import { useTheme } from "../../../../../packages/ui/theme";
import { requireAccount, useAccount } from "../account";
import { deletePostComment, fetchPostDetail, publishPostComment, updateUserPost, useUserPosts, type UserComment, type UserPost } from "./userPosts";
import { UserPostCard } from "./UserPostCard";
import { PostMenu } from "./PostMenu";

const when = (at: number) => new Date(at).toLocaleString();
export function PostDetailScreen({ initialPost, onBack, onApplication, onAuthor }: { initialPost: UserPost; onBack: () => void; onApplication: (appId: string) => Promise<void>; onAuthor: (author: UserPost["author"]) => void }) {
  const { colors } = useTheme(); const { user } = useAccount(); const timeline = useUserPosts();
  const [fallback, setFallback] = useState(initialPost); const post = timeline.posts.find(item => item.id === initialPost.id) ?? fallback;
  const [comments, setComments] = useState<UserComment[]>([]); const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [text, setText] = useState("");
  const [reply, setReply] = useState<UserComment | null>(null); const [sending, setSending] = useState(false); const [deleting, setDeleting] = useState<string | null>(null);
  const alive = useRef(true); const version = useRef(0); const loaded = useRef(false); const reading = useRef(false); const writing = useRef(false); const input = useRef<TextInput>(null);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const count = Array.from(text).length;
  function fail(title: string, cause: unknown) { Toast.show({ type: "error", text1: title, text2: cause instanceof Error ? cause.message : "请稍后重试" }); }
  async function load(more = false) {
    if (reading.current || writing.current || (more && !cursor)) return;
    reading.current = true; setLoading(true); const before = version.current;
    try {
      const result = await fetchPostDetail(initialPost.id, more ? cursor! : undefined);
      if (!alive.current || before !== version.current) return;
      loaded.current = true; setFallback(result.post); updateUserPost(result.post); setCursor(result.nextCursor); setError("");
      setComments(previous => (more ? [...previous, ...result.comments.filter(item => !previous.some(old => old.id === item.id))] : result.comments).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)));
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : "评论加载失败"); }
    finally { reading.current = false; if (alive.current) { setLoading(false); if (before !== version.current && !writing.current) void load(); } }
  }
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => { version.current++; void load(); }, [user?.id]);
  async function send() {
    if (writing.current || !text.trim() || count > 1000) return;
    writing.current = true; setSending(true); version.current++;
    try {
      if (!await requireAccount() || !alive.current) return;
      const signature = JSON.stringify([text.trim(), reply?.id]);
      if (request.current?.signature !== signature) request.current = { signature, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` };
      const result = await publishPostComment(post.id, text.trim(), request.current!.id, reply?.id);
      if (!alive.current) return;
      setFallback(result.post); setComments(previous => previous.some(item => item.id === result.comment.id) ? previous : [...previous, result.comment]);
      setText(""); setReply(null); request.current = null; input.current?.blur();
    } catch (cause) { if (alive.current) fail("评论未发送，内容已保留", cause); }
    finally { writing.current = false; if (alive.current) { setSending(false); if (!loaded.current) void load(); } }
  }
  function remove(comment: UserComment) {
    Alert.alert("删除评论？", "删除后无法恢复。", [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive", onPress: () => { void (async () => {
      if (writing.current) return; writing.current = true; version.current++; setDeleting(comment.id);
      try { const result = await deletePostComment(post.id, comment.id); if (alive.current) { setFallback(result.post); setComments(previous => previous.filter(item => item.id !== comment.id)); if (reply?.id === comment.id) setReply(null); } }
      catch (cause) { if (alive.current) fail("删除未完成", cause); }
      finally { writing.current = false; if (alive.current) setDeleting(null); }
    })(); } }]);
  }
  return <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
    <PageHeader title="动态" onBack={onBack} />
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <FlatList data={comments} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" refreshing={loading && comments.length > 0} onRefresh={() => void load()}
        ListHeaderComponent={<><UserPostCard post={post} own={user?.id === post.author.id} time={when(post.createdAt)} detail onOpen={() => input.current?.focus()} onDeleted={onBack} onApplication={onApplication} onAuthor={onAuthor} onUpdated={setFallback} /><Text style={{ padding: 16, fontSize: 17, fontWeight: "700", color: colors.ink1 }}>评论 · {post.commentCount ?? 0}</Text></>}
        ListEmptyComponent={<View style={{ padding: 24 }}>{loading ? <ActivityIndicator color={colors.accent} /> : !error ? <Text style={{ textAlign: "center", color: colors.ink3 }}>还没有评论，来说点什么吧</Text> : null}</View>}
        renderItem={({ item }) => <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: colors.line }}>
          <Pressable accessibilityLabel={`查看${item.author.name}的主页`} onPress={() => onAuthor(item.author)}>{item.author.avatarUrl ? <FastImage source={{ uri: item.author.avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} /> : <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.field, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.accent }}>{item.author.name.slice(0, 1)}</Text></View>}</Pressable>
          <View style={{ flex: 1 }}><View style={{ flexDirection: "row", alignItems: "center" }}><View style={{ flex: 1 }}><Text onPress={() => onAuthor(item.author)} style={{ color: colors.ink1, fontWeight: "700", fontSize: 15 }}>{item.author.name}</Text><Text style={{ color: colors.ink3, fontSize: 11 }}>{when(item.createdAt)}</Text></View>
            <PostMenu busy={deleting === item.id} onCopy={() => { Clipboard.setString(item.body); Toast.show({ type: "success", text1: "已复制" }); }} onDelete={user?.id === item.author.id ? () => remove(item) : undefined} /></View>
            {item.replyTo ? <Text style={{ color: colors.accent, marginBottom: 4 }}>回复 {item.replyTo.name}</Text> : null}
            <Text selectable style={{ color: colors.ink1, fontSize: 15, lineHeight: 22 }}>{item.body}</Text>
            <Pressable accessibilityLabel={`回复${item.author.name}`} onPress={() => { if (!writing.current) { setReply(item); input.current?.focus(); } }} style={{ alignSelf: "flex-start", paddingVertical: 10, paddingRight: 24 }}><Text style={{ color: colors.ink3, fontSize: 13 }}>回复</Text></Pressable>
          </View></View>}
        ListFooterComponent={<View style={{ padding: 16 }}>{error ? <Pressable onPress={() => void load()}><Text style={{ color: colors.danger, textAlign: "center" }}>{error} · 点击重试</Text></Pressable> : null}{cursor ? <Pressable disabled={loading} onPress={() => void load(true)} style={{ padding: 12 }}>{loading ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.accent, textAlign: "center" }}>查看更多评论</Text>}</Pressable> : null}</View>} />
      <View style={{ padding: 12, borderTopWidth: 0.5, borderTopColor: colors.line, gap: 8 }}>
        {reply ? <Pressable disabled={sending} onPress={() => setReply(null)}><Text style={{ color: colors.accent }}>回复 {reply.author.name} · 取消</Text></Pressable> : null}
        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}><TextInput ref={input} value={text} onChangeText={setText} editable={!sending} multiline maxLength={2000} placeholder="写下你的评论…" placeholderTextColor={colors.ink3} style={{ flex: 1, color: colors.ink1, fontSize: 15, maxHeight: 120, minHeight: 42, padding: 10, backgroundColor: colors.field, borderRadius: 18 }} />
          <Pressable accessibilityLabel="发送评论" disabled={sending || !!deleting || !text.trim() || count > 1000} onPress={() => void send()} style={{ backgroundColor: colors.accent, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, opacity: !text.trim() || count > 1000 || !!deleting ? 0.4 : 1 }}>{sending ? <ActivityIndicator size="small" color={colors.accentText} /> : <Text style={{ color: colors.accentText, fontWeight: "700" }}>发送</Text>}</Pressable></View>
        {count > 800 ? <Text style={{ color: count > 1000 ? colors.danger : colors.ink3, textAlign: "right", fontSize: 12 }}>{count}/1000</Text> : null}
      </View>
    </KeyboardAvoidingView>
  </Screen>;
}
