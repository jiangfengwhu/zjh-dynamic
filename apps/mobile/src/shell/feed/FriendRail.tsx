import { ScrollView, Text, View } from "react-native";
import { Pressy } from "../../../../../packages/ui/chrome";
import { themedStyleSheet } from "../../../../../packages/ui/theme";
import { type Friend } from "../../../../../packages/ui/feed";
import { PixelAvatar, PixelIcon } from "./PixelKit";
import { pixelTheme, usePixelTheme } from "./pixelTheme";
const bootstrap = require("../../../../../tools/applications/bootstrap.json");

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
  const { colors } = usePixelTheme();
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text style={styles.title}>应用朋友</Text>
        <Text style={styles.caption}>{friends.length} 位已加入</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.rail}
        keyboardShouldPersistTaps="handled"
      >
        {friends.map((friend) => {
          const fresh = unread.has(friend.id);
          const Avatar = friend.Avatar;
          return (
            <Pressy
              key={friend.id}
              accessibilityLabel={`打开${friend.name}${
                fresh ? "，有未读动态" : ""
              }`}
              onPress={() => onOpen(friend.id)}
              scale={1}
              style={styles.item}
            >
              <View
                style={[
                  styles.portrait,
                  fresh && { borderColor: colors.accent },
                ]}
              >
                {friend.id === bootstrap.defaultApplication ? (
                  <PixelAvatar size={40} />
                ) : Avatar ? (
                  <Avatar size={40} />
                ) : (
                  <Text
                    style={{
                      fontSize: 20,
                      color: colors.ink1,
                      fontWeight: "800",
                    }}
                  >
                    {friend.mark}
                  </Text>
                )}
                {fresh ? <View style={styles.unread} /> : null}
              </View>
              <Text
                style={[styles.name, fresh && { color: colors.ink1 }]}
                numberOfLines={1}
              >
                {friend.name}
              </Text>
            </Pressy>
          );
        })}
        <Pressy
          accessibilityLabel="发现更多应用"
          onPress={onNew}
          scale={1}
          style={styles.item}
        >
          <View style={[styles.portrait, { borderStyle: "dashed" }]}>
            <PixelIcon name="plus" size={20} color={colors.orchidText} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            发现应用
          </Text>
        </Pressy>
      </ScrollView>
    </View>
  );
}
const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    section: { paddingTop: 6, paddingBottom: 6 },
    heading: {
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    title: { fontSize: 12, fontWeight: "700", color: t.ink2 },
    caption: { fontSize: 10, color: t.ink3, fontFamily: t.mono },
    rail: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
    item: { width: 64, gap: 7, alignItems: "center" },
    portrait: {
      width: 48,
      height: 48,
      borderWidth: 2,
      borderColor: t.line,
      backgroundColor: t.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    unread: {
      position: "absolute",
      right: -4,
      top: -4,
      width: 8,
      height: 8,
      backgroundColor: t.accent,
      borderWidth: 2,
      borderColor: t.canvas,
    },
    name: {
      color: t.ink3,
      fontSize: 11,
      lineHeight: 16,
      width: 64,
      textAlign: "center",
      fontWeight: "500",
    },
  };
});
