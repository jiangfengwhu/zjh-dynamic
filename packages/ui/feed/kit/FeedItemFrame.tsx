import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Pressy } from "../../chrome";
import { useTheme } from "../../theme";
import {
  FeedText,
  useCompactFeed,
  useFeedFrameInset,
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
        lineHeight: 20,
        color: colors.ink1,
      }}
    >
      {name}
    </FeedText>
  );
  return (
    <View
      style={{
        minHeight: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        paddingRight: menu ? 36 : 0,
      }}
    >
      {onIdentity ? (
        <Pressy
          accessibilityLabel={`查看${name}的主页`}
          onPress={onIdentity}
          hitSlop={{ top: 12, bottom: 12 }}
          style={{ flexShrink: 1, minWidth: 0, minHeight: 20 }}
        >
          {title}
        </Pressy>
      ) : (
        title
      )}
      <FeedText
        numberOfLines={1}
        style={{
          flexShrink: 1,
          fontSize: 11,
          lineHeight: 17,
          fontFamily: colors.mono,
          color: colors.ink3,
        }}
      >
        · {time}
      </FeedText>
      {unread ? (
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: accent ?? colors.accent,
          }}
        />
      ) : null}
      {menu ? (
        <View style={{ position: "absolute", right: -4, top: -12 }}>
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
  const compact = useCompactFeed();
  const frameInset = useFeedFrameInset();
  const avatarSlot = (
    <View style={{ width: detail ? 36 : 44, height: 44, alignItems: "center" }}>
      {avatar}
    </View>
  );
  return (
    <View
      style={[
        {
          paddingHorizontal: frameInset,
          paddingTop: compact ? 4 : detail ? 6 : 8,
          paddingBottom: compact ? 3 : detail ? 4 : 6,
        },
        style,
      ]}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: compact ? 5 : 10,
        }}
      >
        {onIdentity ? (
          <Pressy
            accessibilityLabel={`查看${name}的主页`}
            onPress={onIdentity}
            scale={0.92}
            style={{ width: detail ? 36 : 44, height: 44, justifyContent: "flex-start" }}
          >
            {avatarSlot}
          </Pressy>
        ) : (
          avatarSlot
        )}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <FeedItemHeading
            name={name}
            time={time}
            unread={unread}
            accent={accent}
            onIdentity={onIdentity}
            menu={menu}
          />
          {!detail ? <><View style={{ gap: 3 }}>{content}</View>{actions}</> : null}
        </View>
      </View>
      {detail ? <View style={{ gap: 6, paddingTop: 6 }}><View style={{ gap: 3 }}>{content}</View>{actions}</View> : null}
    </View>
  );
}
