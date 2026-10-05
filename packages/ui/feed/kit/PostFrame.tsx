import { FeedItemFrame, FeedItemHeading } from "./FeedItemFrame";
import { FeedActionBar } from "./FeedActionBar";
import { FeedText as Text, useCompactFeed } from "./FeedPresentation";
import { memo, type ReactNode } from "react";
import {
  Pressable,
  Share,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { RichMarkdown } from "../../media/RichMarkdown";
import { Pressy } from "../../chrome";
import { createThemedStyles, useTheme, type Theme } from "../../theme";
import type { FeedCardProps, FeedSlot } from "../store";
import { FriendAvatar } from "./FriendAvatar";
import { SymbolIcon } from "../../chrome/SymbolIcon";

export const KIND_LABEL: Record<FeedSlot, string> = {
  welcome: "新朋友",
  update: "更新",
  activity: "近况",
  summary: "小结",
};

/** 类别的配色。 */
export function kindTone(
  kind: FeedSlot,
  colors: Theme
): { text: string; tint: string } {
  if (kind === "welcome")
    return { text: colors.orchidText, tint: colors.orchidTint };
  if (kind === "update")
    return { text: colors.greenText, tint: colors.greenTint };
  if (kind === "activity")
    return { text: colors.cyanText, tint: colors.cyanTint };
  return { text: colors.accentText, tint: colors.accentTint };
}

/** 头像所在的一列，和上面那行小字的图标、下面的正文都以它为准对齐。 */
const AVATAR = 36;

/** 头像。点一下去 TA 的主页。 */
export const PostAvatar = memo(function PostAvatar({
  friend,
  onOpen,
}: Pick<FeedCardProps, "friend" | "onOpen">) {
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={`打开${friend.name}`}
      onPress={onOpen}
      scale={0.92}
    >
      <FriendAvatar friend={friend} size={AVATAR} />
    </Pressy>
  );
});

/** 名字、时间，没看过的新动态在时间后面有一颗点。 */
export const PostHead = memo(function PostHead({
  friend,
  time,
  unread,
}: Pick<FeedCardProps, "friend" | "time" | "unread">) {
  return (
    <FeedItemHeading
      name={friend.name}
      time={time}
      unread={unread}
      accent={friend.accent}
    />
  );
});

/** 所有动态使用统一的评论、点赞、分享栏。 */
export const PostActions = memo(function PostActions(card: FeedCardProps) {
  return (
    <FeedActionBar
      liked={card.liked}
      onComment={card.onReply}
      onLike={card.onLike}
      onShare={() => {
        void Share.share({
          title: "分享动态",
          message: card.friend.name + "：" + card.post.body,
        }).catch(() => {});
      }}
    />
  );
});

/** 喜欢。点亮的一瞬间心先收一下再弹开。 */
export function LikeButton({
  liked,
  onPress,
}: {
  liked: boolean;
  onPress: () => void;
}) {
  const styles = useFeedStyles();
  const { colors } = useTheme();
  const pop = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityState={{ selected: liked }}
      accessibilityLabel={liked ? "取消喜欢" : "喜欢"}
      onPress={() => {
        if (!liked)
          pop.value = withSequence(
            withTiming(0.78, {
              duration: 90,
              reduceMotion: ReduceMotion.System,
            }),
            withSpring(1, {
              damping: 15,
              stiffness: 300,
              reduceMotion: ReduceMotion.System,
            })
          );
        onPress();
      }}
      scale={0.94}
      style={styles.action}
    >
      <Animated.View style={animated}>
        <SymbolIcon
          name={liked ? "heart" : "heartOutline"}
          size={19}
          color={liked ? colors.red : colors.ink3}
        />
      </Animated.View>
      <Text style={[styles.actionText, liked && { color: colors.red }]}>
        {liked ? "已喜欢" : "喜欢"}
      </Text>
    </Pressy>
  );
}

/** 正文。小结按 Markdown 排，其余是纯文本。 */
export function PostBody({ post }: Pick<FeedCardProps, "post">) {
  const styles = useFeedStyles();
  const { colors } = useTheme();
  const compact = useCompactFeed();
  return post.kind === "summary" ? (
    <RichMarkdown
      markdown={post.body}
      fontFamily={colors.typography.body}
      fontSize={13.5}
      lineHeight={19.5}
    />
  ) : (
    <Text style={styles.text}>{post.body}</Text>
  );
}

/** 无默认样式的内容容器。底色、边框、圆角和内边距均由 App 决定。 */
export function PostAttachment({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={style}>{children}</View>;
}

/**
 * 默认的一条动态：左边头像，右边依次是名字和时间、正文、附件、操作。
 * 外层与用户动态共用 FeedItemFrame，条目分隔由宿主列表负责。朋友登记的卡片也交给它：
 * App 优先使用 content 自绘名字与操作栏之间的完整区域，无默认正文、底色、边框或内边距。
 * body 和 children 保留兼容；没有自定义内容时才使用默认正文。
 */
export const PostFrame = memo(function PostFrame({
  children,
  content,
  body,
  hideBody,
  style,
  ...card
}: FeedCardProps & {
  children?: ReactNode;
  /** 名字与操作栏之间的完整自定义内容区；可含正文、媒体和业务控件，传 null 留空。 */
  content?: ReactNode;
  /** 替换正文。不传就用 post.body，传 null 则不显示正文。 */
  body?: ReactNode;
  hideBody?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useFeedStyles();
  const lead =
    body !== undefined ? body : hideBody ? null : <PostBody post={card.post} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.friend.name}的动态，打开主页`}
      onPress={card.onOpen}
    >
      <FeedItemFrame
        avatar={<FriendAvatar friend={card.friend} size={AVATAR} />}
        name={card.friend.name}
        time={card.time}
        unread={card.unread}
        accent={card.friend.accent}
        onIdentity={card.onOpen}
        style={style}
        content={
          content !== undefined ? (
            content
          ) : (
            <>
              {lead ? <View style={styles.lead}>{lead}</View> : null}
              {children ? <View style={styles.extra}>{children}</View> : null}
            </>
          )
        }
        actions={<PostActions {...card} />}
      />
    </Pressable>
  );
});

const styleFactory = (t: Theme) => ({
  lead: {
    marginTop: 1,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
    color: t.ink1,
  },
  extra: {
    marginTop: 6,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    marginRight: 6,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 44,
  },
  actionText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: t.ink3,
  },
} as const);

const useRegularStyles = createThemedStyles(styleFactory);
const useCompactStyles = createThemedStyles((t) => {
  const original = styleFactory(t);
  return Object.fromEntries(
    Object.entries(original).map(([name, style]) => [
      name,
      Object.fromEntries(
        Object.entries(style).map(([property, value]) => [
          property,
          /^(padding|margin|gap)/.test(property) && typeof value === "number"
            ? value / 2
            : value,
        ])
      ),
    ])
  ) as typeof original;
});
function useFeedStyles() {
  const regularStyles = useRegularStyles();
  const compactStyles = useCompactStyles();
  return useCompactFeed() ? compactStyles : regularStyles;
}
