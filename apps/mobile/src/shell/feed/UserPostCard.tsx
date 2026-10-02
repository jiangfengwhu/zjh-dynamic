import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from "react-native";
import FastImage from "@d11/react-native-fast-image";
import Toast from "react-native-toast-message";
import { themedStyleSheet, useTheme } from "../../../../../packages/ui/theme";
import { deleteUserPost, type UserPost } from "./userPosts";

export function UserPostCard({ post, time, own }: { post: UserPost; time: string; own: boolean }) {
  const { colors } = useTheme(); const [preview, setPreview] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  function remove() { Alert.alert("删除动态", "删除后其他人将看不到这条动态。", [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive", onPress: () => { setBusy(true); void deleteUserPost(post.id).catch(error => Toast.show({ type: "error", text1: "删除失败", text2: error.message })).finally(() => setBusy(false)); } }]); }
  return <View style={styles.row}>
    {post.author.avatarUrl ? <FastImage source={{ uri: post.author.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.placeholder]}><Text style={styles.initial}>{Array.from(post.author.name)[0]}</Text></View>}
    <View style={styles.content}>
      <View style={styles.heading}><Text style={styles.name} numberOfLines={1}>{post.author.name}</Text><Text style={styles.time}>{time}</Text></View>
      {post.body ? <Text selectable style={styles.body}>{post.body}</Text> : null}
      {post.images.length ? <View style={styles.images}>{post.images.map(image => <Pressable key={image.id} accessibilityLabel="查看大图" onPress={() => setPreview(image.url)} style={[styles.imageCell, post.images.length === 1 && styles.singleImage]}><FastImage source={{ uri: image.url }} resizeMode={FastImage.resizeMode.cover} style={styles.image} /></Pressable>)}</View> : null}
      {own ? <Pressable accessibilityLabel="删除自己的动态" disabled={busy} onPress={remove} style={styles.delete}>{busy ? <ActivityIndicator size="small" color={colors.ink3} /> : <Text style={styles.time}>删除</Text>}</Pressable> : null}
    </View>
    <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}><View style={styles.preview}><FastImage source={preview ? { uri: preview } : undefined} resizeMode={FastImage.resizeMode.contain} style={styles.image} /><Pressable accessibilityLabel="关闭大图" onPress={() => setPreview(null)} style={styles.close}><Text style={styles.closeText}>关闭</Text></Pressable></View></Modal>
  </View>;
}
const styles = themedStyleSheet(t => ({
  row: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 18, gap: 12 }, avatar: { width: 42, height: 42, borderRadius: 21 }, placeholder: { backgroundColor: t.accentTint, alignItems: "center", justifyContent: "center" }, initial: { fontSize: 20, color: t.accent }, content: { flex: 1, gap: 10 }, heading: { flexDirection: "row", gap: 8, alignItems: "baseline" }, name: { flexShrink: 1, fontSize: 15, fontWeight: "600", color: t.ink1 }, time: { fontSize: 12, color: t.ink3 }, body: { fontSize: 16, lineHeight: 25, color: t.ink1 }, images: { flexDirection: "row", flexWrap: "wrap", gap: 4 }, imageCell: { width: "49%", aspectRatio: 1, borderRadius: 12, overflow: "hidden", backgroundColor: t.surface }, singleImage: { width: "100%", aspectRatio: 1.35 }, image: { width: "100%", height: "100%" }, delete: { alignSelf: "flex-start", paddingVertical: 6, paddingRight: 18 }, preview: { flex: 1, backgroundColor: "#111111" }, close: { position: "absolute", top: 54, right: 20, padding: 14, borderRadius: 24, backgroundColor: "#333333" }, closeText: { color: "#FFFFFF", fontSize: 15 },
}));
