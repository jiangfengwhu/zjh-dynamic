import { PixelText as Text } from "./PixelText";
import { View } from "react-native";
import { Pressy } from "../../../../../packages/ui/chrome";
import {
  PostBody,
  PostActions,
  KIND_LABEL,
  type FeedCardProps,
} from "../../../../../packages/ui/feed";
import { PixelBadge } from "./PixelKit";
import { usePixelTheme } from "./pixelTheme";
import { PixelAvatar } from "./PixelKit";
const bootstrap = require("../../../../../tools/applications/bootstrap.json");

/** Host fallback only: applications retain ownership of registered cards. */
export function PixelPostFrame(card: FeedCardProps) {
  const { colors } = usePixelTheme();
  const Avatar = card.friend.Avatar;
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 4, gap: 3 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Pressy
          accessibilityLabel={`打开${card.friend.name}`}
          onPress={card.onOpen}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 0,
            borderColor: colors.line,
            backgroundColor: colors.inset,
            alignItems: "center",
            overflow: "hidden",
          }}
        >
          {card.friend.id === bootstrap.defaultApplication ? (
            <PixelAvatar size={36} />
          ) : Avatar ? (
            <Avatar size={36} />
          ) : (
            <Text
              style={{ color: colors.ink1, fontSize: 20, fontWeight: "800" }}
            >
              {card.friend.mark}
            </Text>
          )}
        </Pressy>
        <View style={{ flex: 1, minWidth: 0, gap: 1.5 }}>
          <Text
            style={{ color: colors.ink1, fontSize: 15, fontWeight: "700" }}
            numberOfLines={1}
          >
            {card.friend.name}
          </Text>
          <Text
            style={{
              color: colors.ink3,
              fontSize: 11,
              fontFamily: colors.mono,
            }}
          >
            {card.time}
            {card.unread ? " · 未读" : ""}
          </Text>
        </View>
        <PixelBadge
          label={KIND_LABEL[card.post.kind]}
          color={colors.orchidText}
          background={colors.inset}
        />
      </View>
      <PostBody post={card.post} />
      <PostActions {...card} />
    </View>
  );
}
