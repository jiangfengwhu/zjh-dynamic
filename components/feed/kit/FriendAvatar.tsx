import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { themedStyleSheet, useTheme } from "../../theme";
import type { FeedFriend } from "../store";

/** 一位朋友在动态里的身份：名字、字标、主色，以及可选的自绘头像。 */
export type Friend = FeedFriend;

/** 头像。朋友自己画了头像就用它，没有就用主色底加一个字。 */
export function FriendAvatar({ friend, size }: { friend: Friend; size: number }) {
  useTheme();
  const { Avatar } = friend;
  if (Avatar) {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
        <Avatar size={size} />
      </View>
    );
  }
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2, backgroundColor: friend.accent }]}>
      <Text style={[styles.markText, { fontSize: Math.round(size * 0.42) }]}>{friend.mark}</Text>
    </View>
  );
}

const RING = 2;
const GAP = 3;

/** 头像外的环。有没看过的新内容时是一圈渐变金环，看过之后退成一道发丝线。 */
export function FriendRing({
  friend,
  size,
  unread,
  children,
}: {
  friend: Friend;
  size: number;
  unread: boolean;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const outer = size + (RING + GAP) * 2;
  const inner = size + GAP * 2;
  return (
    <View style={{ width: outer, height: outer, alignItems: "center", justifyContent: "center" }}>
      {unread ? (
        <LinearGradient
          pointerEvents="none"
          colors={[friend.accent, colors.orchid]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", width: outer, height: outer, borderRadius: outer / 2 }}
        />
      ) : (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: outer,
            height: outer,
            borderRadius: outer / 2,
            borderWidth: StyleSheet.hairlineWidth * 2,
            borderColor: colors.lineStrong,
          }}
        />
      )}
      {unread ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.canvas }}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = themedStyleSheet((t) => ({
  mark: {
    alignItems: "center",
    justifyContent: "center",
  },
  markText: {
    fontFamily: t.serif,
    fontWeight: "700",
    color: t.onAccent,
  },
}));
