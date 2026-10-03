import { FeedActionBar } from "../../../../../packages/ui/feed/kit/FeedActionBar";
import { PixelText as Text } from "./PixelText";
import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { EdgeModal } from "../../../../../packages/ui/edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { AppImage } from "../../../../../packages/ui/media/AppImage";
import Clipboard from "@react-native-clipboard/clipboard";
import Toast from "react-native-toast-message";
import { useTheme, type Theme } from "../../../../../packages/ui/theme";
import { requireAccount } from "../account";
import { deleteUserPost, setPostLike, type UserPost } from "./userPosts";
import { PostMenu } from "./PostMenu";
import { edgeUrl } from "../evolveHost";
import { Pressy } from "../../../../../packages/ui/chrome";
import { ApplicationPostCard } from "./ApplicationPostCard";

export function UserPostCard({
  post,
  time,
  own,
  onOpen,
  onDeleted,
  onApplication,
  onAuthor,
  onUpdated,
  detail = false,
}: {
  post: UserPost;
  time: string;
  own: boolean;
  onOpen?: () => void;
  onDeleted?: () => void;
  onApplication: (appId: string) => Promise<void>;
  onAuthor?: (author: UserPost["author"]) => void;
  onUpdated?: (post: UserPost) => void;
  detail?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [liking, setLiking] = useState(false);
  const acting = useRef(false);
  const url = `${edgeUrl}/posts/${post.id}`;
  function remove() {
    Alert.alert("删除动态", "这条动态和它的评论将被删除。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void deleteUserPost(post.id)
            .then(() => onDeleted?.())
            .catch((error) =>
              Toast.show({
                type: "error",
                text1: "删除失败",
                text2: error.message,
              })
            )
            .finally(() => setBusy(false));
        },
      },
    ]);
  }
  async function like() {
    if (acting.current) return;
    acting.current = true;
    setLiking(true);
    try {
      if (await requireAccount()) {
        const updated = await setPostLike(post.id, !post.liked);
        onUpdated?.(updated);
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "点赞未完成",
        text2: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      acting.current = false;
      setLiking(false);
    }
  }
  function share() {
    void Share.share({
      message: `${post.author.name}：${
        post.body ||
        (post.application
          ? `分享了应用《${post.application.title}》`
          : "分享了图片")
      }\n${url}`,
      title: "分享动态",
    }).catch(() => Toast.show({ type: "error", text1: "分享未完成，请重试" }));
  }
  function copy() {
    Clipboard.setString(post.body || url);
    Toast.show({ type: "success", text1: "已复制" });
  }
  const avatar = post.author.avatarUrl ? (
    <AppImage source={{ uri: post.author.avatarUrl }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, styles.placeholder]}>
      <Text style={styles.initial}>{Array.from(post.author.name)[0]}</Text>
    </View>
  );
  return (
    <View style={styles.row}>
      {onAuthor ? (
        <Pressy
          style={styles.avatarControl}
          accessibilityLabel={`查看${post.author.name}的主页`}
          onPress={() => onAuthor(post.author)}
        >
          {avatar}
        </Pressy>
      ) : (
        <View style={styles.avatarControl}>{avatar}</View>
      )}
      <View style={styles.content}>
        <View style={styles.heading}>
          <View style={styles.identity}>
            {onAuthor ? (
              <Pressy
                accessibilityLabel={`查看${post.author.name}的主页`}
                onPress={() => onAuthor?.(post.author)}
                style={{ flexShrink: 1, minWidth: 0 }}
              >
                <Text style={styles.name} numberOfLines={1}>
                  {post.author.name}
                </Text>
              </Pressy>
            ) : (
              <Text style={styles.name} numberOfLines={1}>
                {post.author.name}
              </Text>
            )}
            <Text style={styles.time} numberOfLines={1}>
              · {time}
            </Text>
          </View>
          <PostMenu
            busy={busy}
            onDelete={own ? remove : undefined}
            onCopy={copy}
            onShare={share}
          />
        </View>
        {post.body ? (
          <Text
            accessibilityRole={onOpen ? "button" : undefined}
            accessibilityLabel={onOpen ? "打开动态详情" : undefined}
            onPress={onOpen}
            selectable={detail}
            style={[styles.body, detail && styles.detailBody]}
          >
            {post.body}
          </Text>
        ) : null}
        {post.images.length ? (
          <View style={styles.images}>
            {post.images.map((image) => (
              <Pressable
                key={image.id}
                accessibilityLabel="查看大图"
                onPress={() => setPreview(image.url)}
                style={[
                  styles.imageCell,
                  post.images.length === 1 && styles.singleImage,
                ]}
              >
                <AppImage
                  source={{ uri: image.url }}
                  resizeMode={"cover"}
                  style={styles.image}
                />
              </Pressable>
            ))}
          </View>
        ) : null}
        {post.application ? (
          <ApplicationPostCard
            application={post.application}
            onOpen={onApplication}
          />
        ) : null}
        <FeedActionBar liked={!!post.liked} busy={liking} comments={post.commentCount} likes={post.likeCount} onComment={onOpen} onLike={() => void like()} onShare={share} />
      </View>
      <EdgeModal
        visible={!!preview}
        transparent
        animationType={reduceMotion ? "none" : "fade"}
        onRequestClose={() => setPreview(null)}
      >
        <View
          style={[
            styles.preview,
            { paddingTop: insets.top + 56, paddingBottom: insets.bottom },
          ]}
        >
          <AppImage
            source={preview ? { uri: preview } : undefined}
            resizeMode={"contain"}
            style={styles.previewImage}
          />
          <Pressable
            accessibilityLabel="关闭大图"
            onPress={() => setPreview(null)}
            style={[styles.close, { top: insets.top + 12 }]}
          >
            <Text style={styles.closeText}>关闭</Text>
          </Pressable>
        </View>
      </EdgeModal>
    </View>
  );
}
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      paddingHorizontal: 6,
      paddingVertical: 7,
      gap: 5,
    },
    avatarControl: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "flex-start",
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 0,
      borderColor: t.line,
    },
    placeholder: {
      backgroundColor: t.accentTint,
      alignItems: "center",
      justifyContent: "center",
    },
    initial: { fontSize: 20, color: t.accentText },
    content: { flex: 1, minWidth: 0, gap: 3 },
    heading: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: -3,
      marginRight: -8,
    },
    identity: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "baseline",
      gap: 3,
    },
    name: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: t.ink1 },
    time: {
      flexShrink: 1,
      fontSize: 11,
      lineHeight: 16,
      color: t.ink3,
      fontFamily: t.mono,
    },
    body: { fontSize: 15, lineHeight: 22, color: t.ink1 },
    detailBody: { fontSize: 16, lineHeight: 24 },
    images: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 2 },
    imageCell: {
      width: "49%",
      aspectRatio: 1,
      borderRadius: 0,
      overflow: "hidden",
      backgroundColor: t.surface,
    },
    singleImage: { width: "100%", aspectRatio: 1.35 },
    image: { width: "100%", height: "100%" },
    previewImage: { flex: 1, width: "100%" },
    preview: { flex: 1, backgroundColor: "#141517" },
    close: {
      position: "absolute",
      top: 54,
      right: 20,
      padding: 7,
      borderRadius: 24,
      backgroundColor: "#333333",
    },
    closeText: { color: "#F3F4F0", fontSize: 15 },
  });
