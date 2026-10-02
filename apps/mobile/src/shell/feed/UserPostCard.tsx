import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Share, Text, View } from "react-native";
import FastImage from "@d11/react-native-fast-image";
import Clipboard from "@react-native-clipboard/clipboard";
import { Heart, MessageCircle, Share2 } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { themedStyleSheet, useTheme } from "../../../../../packages/ui/theme";
import { requireAccount } from "../account";
import { deleteUserPost, setPostLike, type UserPost } from "./userPosts";
import { PostMenu } from "./PostMenu";
import { edgeUrl } from "../evolveHost";

export function UserPostCard({ post, time, own, onOpen, onDeleted, detail = false }: { post: UserPost; time: string; own: boolean; onOpen?: () => void; onDeleted?: () => void; detail?: boolean }) {
  const { colors } = useTheme(); const [preview, setPreview] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [liking, setLiking] = useState(false); const acting = useRef(false);
  const url = `${edgeUrl}/posts/${post.id}`;
  function remove() { Alert.alert("删除动态", "这条动态和它的评论将被删除。", [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive", onPress: () => { setBusy(true); void deleteUserPost(post.id).then(() => onDeleted?.()).catch(error => Toast.show({ type: "error", text1: "删除失败", text2: error.message })).finally(() => setBusy(false)); } }]); }
  async function like() {
    if (acting.current) return; acting.current = true; setLiking(true);
    try { if (await requireAccount()) await setPostLike(post.id, !post.liked); }
    catch (error) { Toast.show({ type: "error", text1: "点赞未完成", text2: error instanceof Error ? error.message : "请稍后重试" }); }
    finally { acting.current = false; setLiking(false); }
  }
  function share() { void Share.share({ message: `${post.author.name}：${post.body || "分享了图片"}\n${url}`, title: "分享动态" }).catch(() => Toast.show({ type: "error", text1: "分享未完成，请重试" })); }
  function copy() { Clipboard.setString(post.body || url); Toast.show({ type: "success", text1: "已复制" }); }
  return <View style={styles.row}>
    {post.author.avatarUrl ? <FastImage source={{ uri: post.author.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.placeholder]}><Text style={styles.initial}>{Array.from(post.author.name)[0]}</Text></View>}
    <View style={styles.content}>
      <View style={styles.heading}><View style={styles.identity}><Text style={styles.name} numberOfLines={1}>{post.author.name}</Text><Text style={styles.time}>· {time}</Text></View><PostMenu busy={busy} onDelete={own ? remove : undefined} onCopy={copy} onShare={share} /></View>
      {post.body ? <Text onPress={onOpen} selectable={detail} style={[styles.body, detail && styles.detailBody]}>{post.body}</Text> : null}
      {post.images.length ? <View style={styles.images}>{post.images.map(image => <Pressable key={image.id} accessibilityLabel="查看大图" onPress={() => setPreview(image.url)} style={[styles.imageCell, post.images.length === 1 && styles.singleImage]}><FastImage source={{ uri: image.url }} resizeMode={FastImage.resizeMode.cover} style={styles.image} /></Pressable>)}</View> : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`评论 ${post.commentCount ?? 0} 条`} onPress={onOpen} style={styles.action}><MessageCircle size={19} color={colors.ink3} /><Text style={styles.count}>{post.commentCount || ""}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={post.liked ? "取消点赞" : "点赞"} accessibilityState={{ selected: !!post.liked, disabled: liking }} disabled={liking} onPress={() => void like()} style={styles.action}>{liking ? <ActivityIndicator size="small" color={colors.accent} /> : <Heart size={19} color={post.liked ? "#E85D82" : colors.ink3} fill={post.liked ? "#E85D82" : "none"} />}<Text style={[styles.count, post.liked && { color: "#E85D82" }]}>{post.likeCount || ""}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="分享动态" onPress={share} style={styles.action}><Share2 size={19} color={colors.ink3} /></Pressable>
      </View>
    </View>
    <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}><View style={styles.preview}><FastImage source={preview ? { uri: preview } : undefined} resizeMode={FastImage.resizeMode.contain} style={styles.image} /><Pressable accessibilityLabel="关闭大图" onPress={() => setPreview(null)} style={styles.close}><Text style={styles.closeText}>关闭</Text></Pressable></View></Modal>
  </View>;
}
const styles = themedStyleSheet(t => ({
  row: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 10 }, avatar: { width: 42, height: 42, borderRadius: 21 }, placeholder: { backgroundColor: t.accentTint, alignItems: "center", justifyContent: "center" }, initial: { fontSize: 20, color: t.accent }, content: { flex: 1, minWidth: 0, gap: 6 }, heading: { flexDirection: "row", alignItems: "center", marginTop: -6, marginRight: -8 }, identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", gap: 6 }, name: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: t.ink1 }, time: { fontSize: 12, color: t.ink3 }, body: { fontSize: 15.5, lineHeight: 23, color: t.ink1 }, detailBody: { fontSize: 18, lineHeight: 28 }, images: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }, imageCell: { width: "49%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: t.surface }, singleImage: { width: "100%", aspectRatio: 1.35 }, image: { width: "100%", height: "100%" }, actions: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingRight: 18 }, action: { minHeight: 40, minWidth: 56, flexDirection: "row", alignItems: "center", gap: 6 }, count: { fontSize: 12, color: t.ink3 }, preview: { flex: 1, backgroundColor: "#111111" }, close: { position: "absolute", top: 54, right: 20, padding: 14, borderRadius: 24, backgroundColor: "#333333" }, closeText: { color: "#FFFFFF", fontSize: 15 },
}));
