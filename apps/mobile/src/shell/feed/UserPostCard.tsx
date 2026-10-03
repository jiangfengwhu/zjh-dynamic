import { useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Share, Text, View } from "react-native";
import { EdgeModal } from "../../../../../packages/ui/edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import FastImage from "@d11/react-native-fast-image";
import Clipboard from "@react-native-clipboard/clipboard";
import { Heart, MessageCircle, Share2 } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { themedStyleSheet, useTheme } from "../../../../../packages/ui/theme";
import { requireAccount } from "../account";
import { deleteUserPost, setPostLike, type UserPost } from "./userPosts";
import { PostMenu } from "./PostMenu";
import { edgeUrl } from "../evolveHost";
import { Pressy } from "../../../../../packages/ui/chrome";
import { ApplicationPostCard } from "./ApplicationPostCard";

export function UserPostCard({ post, time, own, onOpen, onDeleted, onApplication, onAuthor, onUpdated, detail = false }: { post: UserPost; time: string; own: boolean; onOpen?: () => void; onDeleted?: () => void; onApplication: (appId: string) => Promise<void>; onAuthor?: (author: UserPost["author"]) => void; onUpdated?: (post: UserPost) => void; detail?: boolean }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { colors } = useTheme(); const [preview, setPreview] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [liking, setLiking] = useState(false); const acting = useRef(false);
  const url = `${edgeUrl}/posts/${post.id}`;
  function remove() { Alert.alert("删除动态", "这条动态和它的评论将被删除。", [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive", onPress: () => { setBusy(true); void deleteUserPost(post.id).then(() => onDeleted?.()).catch(error => Toast.show({ type: "error", text1: "删除失败", text2: error.message })).finally(() => setBusy(false)); } }]); }
  async function like() {
    if (acting.current) return; acting.current = true; setLiking(true);
    try { if (await requireAccount()) { const updated = await setPostLike(post.id, !post.liked); onUpdated?.(updated); } }
    catch (error) { Toast.show({ type: "error", text1: "点赞未完成", text2: error instanceof Error ? error.message : "请稍后重试" }); }
    finally { acting.current = false; setLiking(false); }
  }
  function share() { void Share.share({ message: `${post.author.name}：${post.body || (post.application ? `分享了应用《${post.application.title}》` : "分享了图片")}\n${url}`, title: "分享动态" }).catch(() => Toast.show({ type: "error", text1: "分享未完成，请重试" })); }
  function copy() { Clipboard.setString(post.body || url); Toast.show({ type: "success", text1: "已复制" }); }
  const avatar = post.author.avatarUrl ? <FastImage source={{ uri: post.author.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.placeholder]}><Text style={styles.initial}>{Array.from(post.author.name)[0]}</Text></View>;
  return <View style={styles.row}>
    {onAuthor ? <Pressy style={styles.avatarControl} accessibilityLabel={`查看${post.author.name}的主页`} onPress={() => onAuthor(post.author)}>{avatar}</Pressy> : <View style={styles.avatarControl}>{avatar}</View>}
    <View style={styles.content}>
      <View style={styles.heading}><View style={styles.identity}><Text onPress={onAuthor ? () => onAuthor(post.author) : undefined} style={styles.name} numberOfLines={1}>{post.author.name}</Text><Text style={styles.time} numberOfLines={1}>· {time}</Text></View><PostMenu busy={busy} onDelete={own ? remove : undefined} onCopy={copy} onShare={share} /></View>
      {post.body ? <Text onPress={onOpen} selectable={detail} style={[styles.body, detail && styles.detailBody]}>{post.body}</Text> : null}
      {post.images.length ? <View style={styles.images}>{post.images.map(image => <Pressable key={image.id} accessibilityLabel="查看大图" onPress={() => setPreview(image.url)} style={[styles.imageCell, post.images.length === 1 && styles.singleImage]}><FastImage source={{ uri: image.url }} resizeMode={FastImage.resizeMode.cover} style={styles.image} /></Pressable>)}</View> : null}
      {post.application ? <ApplicationPostCard application={post.application} onOpen={onApplication} /> : null}
      <View style={styles.actions}>
        <Pressy accessibilityRole="button" accessibilityLabel={`评论 ${post.commentCount ?? 0} 条`} onPress={onOpen} style={styles.action}><MessageCircle size={19} color={colors.ink3} /><Text style={styles.count}>{post.commentCount || ""}</Text></Pressy>
        <Pressy accessibilityRole="button" accessibilityLabel={post.liked ? "取消点赞" : "点赞"} accessibilityState={{ selected: !!post.liked, disabled: liking }} disabled={liking} onPress={() => void like()} style={styles.action}>{liking ? <ActivityIndicator size="small" color={colors.accent} /> : <Heart size={19} color={post.liked ? colors.accentText : colors.ink3} fill={post.liked ? colors.accentText : "none"} />}<Text style={[styles.count, post.liked && { color: colors.accentText }]}>{post.likeCount || ""}</Text></Pressy>
        <Pressy accessibilityRole="button" accessibilityLabel="分享动态" onPress={share} style={styles.action}><Share2 size={19} color={colors.ink3} /></Pressy>
      </View>
    </View>
    <EdgeModal visible={!!preview} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setPreview(null)}><View style={[styles.preview, { paddingTop: insets.top + 56, paddingBottom: insets.bottom } ]}><FastImage source={preview ? { uri: preview } : undefined} resizeMode={FastImage.resizeMode.contain} style={styles.previewImage} /><Pressable accessibilityLabel="关闭大图" onPress={() => setPreview(null)} style={[styles.close, { top: insets.top + 12 }]}><Text style={styles.closeText}>关闭</Text></Pressable></View></EdgeModal>
  </View>;
}
const styles = themedStyleSheet(t => ({
  row: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }, avatarControl: { width: 44, height: 44, alignItems: "center", justifyContent: "flex-start" }, avatar: { width: 36, height: 36, borderRadius: 18 }, placeholder: { backgroundColor: t.accentTint, alignItems: "center", justifyContent: "center" }, initial: { fontSize: 20, color: t.accentText }, content: { flex: 1, minWidth: 0, gap: 6 }, heading: { flexDirection: "row", alignItems: "center", marginTop: -6, marginRight: -8 }, identity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "baseline", gap: 6 }, name: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: t.ink1 }, time: { flexShrink: 1, fontSize: 11, lineHeight: 16, color: t.ink3, fontFamily: t.mono }, body: { fontSize: 15, lineHeight: 22, color: t.ink1 }, detailBody: { fontSize: 16, lineHeight: 24 }, images: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }, imageCell: { width: "49%", aspectRatio: 1, borderRadius: t.radius.sm, overflow: "hidden", backgroundColor: t.surface }, singleImage: { width: "100%", aspectRatio: 1.35 }, image: { width: "100%", height: "100%" }, actions: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 4, marginTop: 2 }, action: { minHeight: 44, minWidth: 44, flexDirection: "row", alignItems: "center", gap: 6 }, count: { fontSize: 12, color: t.ink3, fontFamily: t.mono }, previewImage: { flex: 1, width: "100%" }, preview: { flex: 1, backgroundColor: "#141517" }, close: { position: "absolute", top: 54, right: 20, padding: 14, borderRadius: 24, backgroundColor: "#333333" }, closeText: { color: "#F3F4F0", fontSize: 15 },
}));
