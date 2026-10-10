import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Pressy } from "../../chrome";
import { useTheme } from "../../theme";
import {
  FeedText,
  useCompactFeed,
  useFeedFrameInset,
  useFeedRowWidth,
  FeedContentWidthContext,
} from "./FeedPresentation";

/** Shared identity row; the menu never changes the content's vertical origin. */
export function FeedItemHeading({
  name,
  time,
  unread,
  accent,
  onIdentity,
  menu,
  inline = false,
}: {
  name: string;
  time: ReactNode;
  unread?: boolean;
  accent?: string;
  onIdentity?: () => void;
  menu?: ReactNode;
  /** 时间线样式：名字与时间同一行；详情页为上下两行。 */
  inline?: boolean;
}) {
  const { colors } = useTheme();
  const title = (
    <FeedText
      numberOfLines={1}
      style={{
        flexShrink: 1,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: "700",
        color: colors.ink1,
        letterSpacing: -0.2,
      }}
    >
      {name}
    </FeedText>
  );
  const name_ = onIdentity ? (
    <Pressy
      accessibilityLabel={`查看${name}的主页`}
      onPress={onIdentity}
      hitSlop={{ top: 10, bottom: 4 }}
      style={{ flexShrink: 1, minWidth: 0, minHeight: 20 }}
    >
      {title}
    </Pressy>
  ) : (
    title
  );
  const dot = unread ? (
    <View
      style={{
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: accent ?? colors.orchid,
      }}
    />
  ) : null;
  const timeText = (
    <FeedText
      numberOfLines={1}
      style={{
        flexShrink: 0,
        fontSize: inline ? 13 : 12,
        lineHeight: inline ? 20 : 16,
        fontFamily: colors.sans,
        color: colors.ink3,
      }}
    >
      {inline ? <>· {time}</> : time}
    </FeedText>
  );
  if (inline) return (
    <View
      style={{
        minHeight: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingRight: menu ? 28 : 0,
      }}
    >
      {name_}
      {timeText}
      {dot}
      {menu ? (
        <View style={{ position: "absolute", right: -6, top: -6 }}>
          {menu}
        </View>
      ) : null}
    </View>
  );
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 40,
        justifyContent: "center",
        paddingRight: menu ? 28 : 0,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {name_}
        {dot}
      </View>
      {timeText}
      {menu ? (
        <View style={{ position: "absolute", right: -6, top: 4 }}>
          {menu}
        </View>
      ) : null}
    </View>
  );
}

/** One layout for user and application posts. Only content owns the custom body. */
export function FeedItemFrame({
  avatar,
  name,
  time,
  unread,
  accent,
  onIdentity,
  menu,
  content,
  actions,
  style,
  detail = false,
}: {
  avatar: ReactNode;
  name: string;
  time: ReactNode;
  unread?: boolean;
  accent?: string;
  onIdentity?: () => void;
  menu?: ReactNode;
  content: ReactNode;
  actions: ReactNode;
  style?: StyleProp<ViewStyle>;
  detail?: boolean;
}) {
  const compact = useCompactFeed();
  const frameInset = useFeedFrameInset();
  const rowWidth = useFeedRowWidth();
  const avatarSize = detail ? 44 : 40;
  const gap = compact ? 10 : 12;
  // 时间线条目的正文缩进到头像右侧；详情页正文占满整行。
  const contentWidth = rowWidth === undefined
    ? undefined
    : Math.max(1, Math.floor(rowWidth - frameInset * 2 - (detail ? 0 : avatarSize + gap)));
  const avatarSlot = (
    <View style={{ width: avatarSize, height: avatarSize, alignItems: "center", justifyContent: "center" }}>
      {avatar}
    </View>
  );
  const avatarNode = onIdentity ? (
    <Pressy
      accessibilityLabel={`查看${name}的主页`}
      onPress={onIdentity}
      scale={0.94}
      hitSlop={4}
      style={{ width: avatarSize, height: avatarSize, minWidth: avatarSize, minHeight: avatarSize }}
    >
      {avatarSlot}
    </Pressy>
  ) : (
    avatarSlot
  );
  if (!detail) return (
    <FeedContentWidthContext.Provider value={contentWidth}>
      <View
        style={[
          {
            flexDirection: "row",
            alignItems: "flex-start",
            gap,
            paddingHorizontal: frameInset,
            paddingTop: 12,
            paddingBottom: 4,
          },
          style,
        ]}
      >
        {avatarNode}
        <View style={{ flex: 1, minWidth: 0 }}>
          <FeedItemHeading
            inline
            name={name}
            time={time}
            unread={unread}
            accent={accent}
            onIdentity={onIdentity}
            menu={menu}
          />
          <View style={{ paddingTop: 3, gap: 4 }}>
            <View style={{ gap: 8 }}>{content}</View>
            {actions}
          </View>
        </View>
      </View>
    </FeedContentWidthContext.Provider>
  );
  return (
    <FeedContentWidthContext.Provider value={contentWidth}><View
      style={[
        { paddingHorizontal: frameInset, paddingTop: 8, paddingBottom: 4 },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap,
        }}
      >
        {avatarNode}
        <FeedItemHeading
          name={name}
          time={time}
          unread={unread}
          accent={accent}
          onIdentity={onIdentity}
          menu={menu}
        />
      </View>
      <View style={{ paddingTop: 12, gap: 10 }}>
        <View style={{ gap: 12 }}>{content}</View>
        {actions}
      </View>
    </View></FeedContentWidthContext.Provider>
  );
}
