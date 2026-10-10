import { openPostSharing } from "../sharePanel";
import { useRecyclingState, useMappingHelper } from "@shopify/flash-list";
import { lazyScreen } from "../lazyScreen";
import { UserAvatar } from "../UserAvatar";
import { HostAlert as Alert } from "../HostAlert";
import { FeedItemFrame } from "../../../../../packages/ui/feed/kit/FeedItemFrame";
import { FeedActionBar } from "../../../../../packages/ui/feed/kit/FeedActionBar";
import { HostText as Text } from "./HostText";
import { memo, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
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
const HtmlPostContent = lazyScreen(() => (require("./HtmlPostContent") as typeof import("./HtmlPostContent")).HtmlPostContent);
import { ApplicationPostCard } from "./ApplicationPostCard";

export const UserPostCard = memo(function UserPostCard({
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
  onApplication: (appId: string, params?: import("../../../../../packages/app-sdk/src").ShareParams) => Promise<void>;
  onAuthor?: (author: UserPost["author"]) => void;
  onUpdated?: (post: UserPost) => void;
  detail?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [preview, setPreview] = useRecyclingState<string | null>(null, [post.id]);
  const [busy, setBusy] = useRecyclingState(false, [post.id]);
  const { getMappingKey } = useMappingHelper();
  const identity = useRef(post.id); identity.current = post.id;
  const likeRevision = useRef(0);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; likeRevision.current++; return () => { alive.current = false; }; }, [post.id]);
  const acting = useRef(false);
  const url = `${edgeUrl}/posts/${post.id}`;
  function remove() {
    Alert.alert("删除动态", "这条动态和它的评论将被删除。", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => {
          if (identity.current !== post.id) return;
          setBusy(true);
          void deleteUserPost(post.id)
            .then(() => { if (identity.current === post.id) onDeleted?.(); })
            .catch((error) =>
              Toast.show({
                type: "error",
                text1: "删除失败",
                text2: error.message,
              })
            )
            .finally(() => { if (identity.current === post.id) setBusy(false); });
        },
      },
    ]);
  }
  async function like() {
    // Only the login prompt is gated; network requests never disable the heart.
    if (!cachedAccountId()) {
      if (acting.current) return;
      acting.current = true;
      try { if (!await requireAccount() || !alive.current || identity.current !== post.id) return; }
      finally { acting.current = false; }
    }
    const owner = cachedAccountId();
    const revision = ++likeRevision.current;
    const result = togglePostLike(post);
    onUpdated?.(result.post);
    void result.settled.then(({ post: updated, error }) => {
      if (!alive.current || revision !== likeRevision.current || identity.current !== post.id || owner !== cachedAccountId()) return;
      onUpdated?.(updated);
      if (error) Toast.show({
        type: "error", text1: "点赞未同步，已恢复",
        text2: error instanceof Error ? error.message : "请稍后重试",
      });
    });
  }
  function share() {
    void openPostSharing(post).catch(error => Toast.show({ type: "error", text1: "分享未完成", text2: error.message }));
  }
  function copy() {
    Clipboard.setString(post.body || url);
    Toast.show({ type: "success", text1: "已复制" });
  }
  const avatar = <UserAvatar uri={post.author.avatarUrl} authorId={post.author.id} size={detail ? 44 : 40} style={detail ? styles.detailAvatar : styles.avatar} />;
  return (
    <>
      <Pressable
        accessible={false}
        disabled={detail || !onOpen}
        onPress={onOpen}
        style={styles.openArea}
      >
        <FeedItemFrame
          detail={detail}
          avatar={avatar}
          name={post.author.name}
          time={time}
          onIdentity={onAuthor ? () => onAuthor(post.author) : undefined}
          menu={
            <PostMenu
              identity={post.id}
              busy={busy}
              onDelete={own && !post.applicationDiscussion ? remove : undefined}
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
                <View style={{ paddingTop: !post.body && !detail ? 6 : 0 }}>
                <HtmlPostContent
                  html={post.content.html}
                  fallback={post.body}
                  onApplication={onApplication}
                  onImage={setPreview}
                />
                </View>
              ) : null}
              {post.images.length ? (
                <View style={styles.images}>
                  {post.images.map((image, index) => (
                    <Pressable
                      key={getMappingKey(image.id, index)}
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
              identity={post.id}
              liked={!!post.liked}
              comments={post.commentCount}
              likes={post.likeCount}
              views={post.viewCount ?? 0}
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
});
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    openArea: { alignSelf: "stretch", minHeight: 44 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 0,
      borderColor: t.line,
    },
    detailAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 0 },
    body: { fontSize: 15, lineHeight: 22, color: t.ink1, letterSpacing: 0.1 },
    detailBody: { fontSize: 17, lineHeight: 26 },
    images: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    imageCell: {
      width: "48%",
      flexGrow: 1,
      aspectRatio: 1,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: t.surfaceRaised,
    },
    singleImage: { width: "100%", aspectRatio: 1.4, borderRadius: 16 },
    image: { width: "100%", height: "100%" },
    previewImage: { flex: 1, width: "100%" },
    preview: { flex: 1, backgroundColor: "#000000" },
    close: {
      position: "absolute",
      top: 54,
      right: 16,
      minHeight: 36,
      paddingHorizontal: 16,
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.16)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.22)",
    },
    closeText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700", letterSpacing: -0.1 },
  });
