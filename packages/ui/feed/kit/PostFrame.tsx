import { FeedText as Text, useCompactFeed } from "./FeedPresentation";
import { memo, type ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { RichMarkdown } from "../../media/RichMarkdown";
import { Icon, Pressy } from "../../chrome";
import { themedStyleSheet, useTheme, type Theme } from "../../theme";
import type { FeedCardProps, FeedSlot } from "../store";
import { FriendAvatar } from "./FriendAvatar";
import { BubbleGlyph, HeartGlyph } from "./glyphs";

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
const GUTTER = 10;
const SIDE = 14;

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
  const styles = useFeedStyles();
  return (
    <View style={styles.head}>
      <Text style={styles.name} numberOfLines={1}>
        {friend.name}
      </Text>
      <Text style={styles.time} numberOfLines={1}>
        · {time}
      </Text>
      {unread ? (
        <View style={[styles.dot, { backgroundColor: friend.accent }]} />
      ) : null}
    </View>
  );
});

/** 底部操作：对 TA 说、喜欢、打开主页，均匀排开。 */
export const PostActions = memo(function PostActions({
  friend,
  liked,
  onLike,
  onReply,
  onOpen,
}: FeedCardProps) {
  const styles = useFeedStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.actions}>
      <Pressy
        accessibilityRole="button"
        accessibilityLabel={`对${friend.name}说一句`}
        onPress={onReply}
        scale={0.94}
        style={styles.action}
      >
        <BubbleGlyph size={15} color={colors.ink3} />
        <Text style={styles.actionText}>对 TA 说</Text>
      </Pressy>
      <LikeButton liked={liked} onPress={onLike} />
      <Pressy
        accessibilityRole="button"
        accessibilityLabel={`打开${friend.name}`}
        onPress={onOpen}
        scale={0.94}
        style={styles.action}
      >
        <Text
          style={[
            styles.actionText,
            { color: colors.accentText, fontWeight: "700" },
          ]}
        >
          主页
        </Text>
        <Icon
          name="chevron"
          size={11}
          color={colors.accentText}
          strokeWidth={2.2}
        />
      </Pressy>
    </View>
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
        <HeartGlyph
          size={19}
          color={liked ? colors.red : colors.ink3}
          filled={liked}
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
    <RichMarkdown markdown={post.body} fontFamily={compact ? "Fusion Pixel 12px Proportional SC" : colors.sans} fontSize={13.5} lineHeight={19.5} />
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
 * 没有卡片外框，条与条之间的分隔线由壳画。朋友登记的卡片也交给它：
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
  /** 完整内容区域，包括正文和交互控件；传 null 可以留空。 */
  content?: ReactNode;
  /** 替换正文。不传就用 post.body，传 null 则不显示正文。 */
  body?: ReactNode;
  hideBody?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useFeedStyles();
  const lead =
    body !== undefined ? body : hideBody ? null : <PostBody post={card.post} />;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${card.friend.name}的动态，打开主页`}
      onPress={card.onOpen}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: colors.inset },
        style,
      ]}
    >
      <View style={styles.main}>
        <PostAvatar friend={card.friend} onOpen={card.onOpen} />
        <View style={styles.column}>
          <PostHead
            friend={card.friend}
            time={card.time}
            unread={card.unread}
          />
          {content !== undefined ? (
            content
          ) : (
            <>
              {lead ? <View style={styles.lead}>{lead}</View> : null}
              {children ? <View style={styles.extra}>{children}</View> : null}
            </>
          )}
          <PostActions {...card} />
        </View>
      </View>
    </Pressable>
  );
});

const styleFactory = (t: Theme) => ({
  row: {
    paddingTop: 8,
    paddingBottom: 5,
    paddingHorizontal: SIDE,
  },
  main: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: GUTTER,
  },
  column: {
    flex: 1,
    minWidth: 0,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 18,
  },
  name: {
    flexShrink: 1,
    fontFamily: t.serif,
    fontSize: 14.5,
    lineHeight: 19,
    fontWeight: "700",
    color: t.ink1,
  },
  time: {
    flexShrink: 1,
    fontSize: 11,
    lineHeight: 17,
    fontFamily: t.mono,
    color: t.ink3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
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
});

const regularStyles = themedStyleSheet(styleFactory);
const compactStyles = themedStyleSheet((t) => {
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
  return useCompactFeed() ? compactStyles : regularStyles;
}
