import { UserAvatar } from "../UserAvatar";
import { PixelAlert as Alert } from "../PixelAlert";
import { FeedItemFrame } from "../../../../../packages/ui/feed/kit/FeedItemFrame";
import { FeedActionBar } from "../../../../../packages/ui/feed/kit/FeedActionBar";
import { PixelText as Text } from "./PixelText";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { EdgeModal } from "../../../../../packages/ui/edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { AppImage } from "../../../../../packages/ui/media/AppImage";
import Clipboard from "@react-native-clipboard/clipboard";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { useTheme, type Theme } from "../../../../../packages/ui/theme";
import { cachedAccountId, requireAccount } from "../account";
import { deleteUserPost, togglePostLike, type UserPost } from "./userPosts";
import { PostMenu } from "./PostMenu";
import { edgeUrl } from "../evolveHost";
import { HtmlPostContent } from "./HtmlPostContent";
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
  const likeRevision = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
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
    // Only the login prompt is gated; network requests never disable the heart.
    if (!cachedAccountId()) {
      if (acting.current) return;
      acting.current = true;
      try { if (!await requireAccount() || !alive.current) return; }
      finally { acting.current = false; }
    }
    const owner = cachedAccountId();
    const revision = ++likeRevision.current;
    const result = togglePostLike(post);
    onUpdated?.(result.post);
    void result.settled.then(({ post: updated, error }) => {
      if (!alive.current || revision !== likeRevision.current || owner !== cachedAccountId()) return;
      onUpdated?.(updated);
      if (error) Toast.show({
        type: "error", text1: "点赞未同步，已恢复",
        text2: error instanceof Error ? error.message : "请稍后重试",
      });
    });
  }
  function share() {
    void Share.share({
      message: `${post.author.name}：${
        post.body ||
        (post.application
          ? `分享了应用《${post.application.title}》`
          : post.content
          ? "分享了动态"
          : "分享了图片")
      }\n${url}`,
      title: "分享动态",
    }).catch(() => Toast.show({ type: "error", text1: "分享未完成，请重试" }));
  }
  function copy() {
    Clipboard.setString(post.body || url);
    Toast.show({ type: "success", text1: "已复制" });
  }
  const avatar = <UserAvatar uri={post.author.avatarUrl} authorId={post.author.id} size={36} style={styles.avatar} />;
  return (
    <>
      <Pressable
        accessible={false}
        disabled={detail || !onOpen}
        onPress={onOpen}
        style={styles.openArea}
      >
        <FeedItemFrame
          avatar={avatar}
          name={post.author.name}
          time={time}
          onIdentity={onAuthor ? () => onAuthor(post.author) : undefined}
          menu={
            <PostMenu
              busy={busy}
              onDelete={own ? remove : undefined}
              onCopy={copy}
              onShare={share}
            />
          }
          content={
            <>
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
              {post.content?.format === "html" && post.content.version === 1 ? (
                <HtmlPostContent
                  html={post.content.html}
                  fallback={post.body}
                  onApplication={onApplication}
                  onImage={setPreview}
                />
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
            </>
          }
          actions={
            <FeedActionBar
              liked={!!post.liked}
              comments={post.commentCount}
              likes={post.likeCount}
              onComment={onOpen}
              onLike={() => void like()}
              onShare={share}
            />
          }
        />
      </Pressable>
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
    </>
  );
}
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    openArea: { alignSelf: "stretch", minHeight: 44 },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 0,
      borderColor: t.line,
    },
    body: { fontSize: 15, lineHeight: 22, color: t.ink1 },
    detailBody: { fontSize: 16, lineHeight: 24 },
    images: { flexDirection: "row", flexWrap: "wrap", gap: 2, marginTop: 2 },
    imageCell: {
      width: "49%",
      aspectRatio: 1,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: t.surface,
    },
    singleImage: { width: "100%", aspectRatio: 1.35 },
    image: { width: "100%", height: "100%", borderRadius: 12 },
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
