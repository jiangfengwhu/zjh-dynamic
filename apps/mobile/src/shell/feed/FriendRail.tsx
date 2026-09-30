import { ScrollView, Text, View } from "react-native";
import Animated, { Easing, FadeInRight } from "react-native-reanimated";
import { Icon, Pressy } from "../../../../../packages/ui/chrome";
import { themedStyleSheet, useTheme } from "../../../../../packages/ui/theme";
import { FriendAvatar, FriendRing, type Friend } from "../../../../../packages/ui/feed";

const AVATAR = 40;

/**
 * 动态顶部的朋友栏。每位朋友一个头像，有没看过的新动态就亮一圈金环，
 * 点一下直接去 TA 的主页。第一个位置留给「找新朋友」，通向工坊。
 */
export function FriendRail({
  friends,
  unread,
  onOpen,
  onNew,
}: {
  friends: Friend[];
  unread: ReadonlySet<string>;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const { colors } = useTheme();
  const outer = AVATAR + 8;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      keyboardShouldPersistTaps="handled"
    >
      <Pressy accessibilityRole="button" accessibilityLabel="去工坊做个应用" onPress={onNew} scale={0.94} style={styles.item}>
        <View
          style={[
            styles.invite,
            { width: outer, height: outer, borderRadius: outer / 2, backgroundColor: colors.accentTint, borderColor: colors.accentSoft },
          ]}
        >
          <Icon name="plus" size={15} color={colors.accentText} strokeWidth={2} />
        </View>
        <Text style={[styles.name, { color: colors.accentText }]} numberOfLines={1}>
        做个应用
        </Text>
      </Pressy>

      {friends.map((friend, index) => (
        <Animated.View
          key={friend.id}
          entering={FadeInRight.delay(80 + index * 60).duration(420).easing(Easing.out(Easing.cubic))}
        >
          <Pressy
            accessibilityRole="button"
            accessibilityLabel={`打开${friend.name}`}
            onPress={() => onOpen(friend.id)}
            scale={0.94}
            style={styles.item}
          >
            <FriendRing friend={friend} size={AVATAR} unread={unread.has(friend.id)}>
              <FriendAvatar friend={friend} size={AVATAR} />
            </FriendRing>
            <Text style={[styles.name, unread.has(friend.id) && { color: colors.ink1, fontWeight: "700" }]} numberOfLines={1}>
              {friend.name}
            </Text>
          </Pressy>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

const styles = themedStyleSheet((t) => ({
  rail: {
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 14,
  },
  item: {
    width: 64,
    alignItems: "center",
    gap: 6,
  },
  invite: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  name: {
    maxWidth: 64,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    color: t.ink2,
  },
}));
