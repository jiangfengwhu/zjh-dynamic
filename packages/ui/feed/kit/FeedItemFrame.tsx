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
}: {
  name: string;
  time: string;
  unread?: boolean;
  accent?: string;
  onIdentity?: () => void;
  menu?: ReactNode;
}) {
  const { colors } = useTheme();
  const title = (
    <FeedText
      numberOfLines={1}
      style={{
        flexShrink: 1,
        fontSize: 15,
        lineHeight: 21,
        fontWeight: "700",
        color: colors.ink1,
        letterSpacing: -0.2,
      }}
    >
      {name}
    </FeedText>
  );
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 40,
        justifyContent: "center",
        paddingRight: menu ? 36 : 0,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {onIdentity ? (
          <Pressy
            accessibilityLabel={`查看${name}的主页`}
            onPress={onIdentity}
            hitSlop={{ top: 10, bottom: 4 }}
            style={{ flexShrink: 1, minWidth: 0, minHeight: 21 }}
          >
            {title}
          </Pressy>
        ) : (
          title
        )}
        {unread ? (
          <View
            style={{
              width: 7,
              height: 7,
              borderRadius: 3.5,
              backgroundColor: accent ?? colors.orchid,
            }}
          />
        ) : null}
      </View>
      <FeedText
        numberOfLines={1}
        style={{
          fontSize: 12,
          lineHeight: 17,
          fontFamily: colors.sans,
          color: colors.ink3,
        }}
      >
        {time}
      </FeedText>
      {menu ? (
        <View style={{ position: "absolute", right: -10, top: -2 }}>
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
  time: string;
  unread?: boolean;
  accent?: string;
  onIdentity?: () => void;
  menu?: ReactNode;
  content: ReactNode;
  actions: ReactNode;
  style?: StyleProp<ViewStyle>;
  detail?: boolean;
}) {
  const { colors } = useTheme();
  const compact = useCompactFeed();
  const frameInset = useFeedFrameInset();
  const rowWidth = useFeedRowWidth();
  const border = detail || colors.mode !== "dark" ? 0 : colors.components.surfaceBorder;
  const contentWidth = rowWidth === undefined ? undefined : Math.max(1, Math.floor(rowWidth - frameInset * 2 - border * 2));
  const avatarSize = detail ? 44 : 40;
  const avatarSlot = (
    <View style={{ width: avatarSize, height: avatarSize, alignItems: "center", justifyContent: "center" }}>
      {avatar}
    </View>
  );
  return (
    <FeedContentWidthContext.Provider value={contentWidth}><View
      style={[
        detail
          ? { paddingHorizontal: frameInset, paddingTop: 8, paddingBottom: 6 }
          : {
              paddingHorizontal: frameInset,
              paddingTop: 18,
              paddingBottom: 6,
              backgroundColor: colors.surface,
              borderRadius: colors.radius.xl,
              borderWidth: border,
              borderColor: colors.line,
              boxShadow: colors.shadow.card,
            },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: compact ? 10 : 12,
        }}
      >
        {onIdentity ? (
          <Pressy
            accessibilityLabel={`查看${name}的主页`}
            onPress={onIdentity}
            scale={0.92}
            hitSlop={4}
            style={{ width: avatarSize, height: avatarSize, minWidth: avatarSize, minHeight: avatarSize }}
          >
            {avatarSlot}
          </Pressy>
        ) : (
          avatarSlot
        )}
        <FeedItemHeading
          name={name}
          time={time}
          unread={unread}
          accent={accent}
          onIdentity={onIdentity}
          menu={menu}
        />
      </View>
      <View style={{ paddingTop: detail ? 16 : 14, gap: detail ? 14 : 10 }}>
        <View style={{ gap: detail ? 14 : 12 }}>{content}</View>
        {actions}
      </View>
    </View></FeedContentWidthContext.Provider>
  );
}
