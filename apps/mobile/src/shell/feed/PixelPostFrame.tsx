import { PixelText as Text } from "./PixelText";
import { View } from "react-native";
import { Pressy } from "../../../../../packages/ui/chrome";
import {
  PostBody,
  KIND_LABEL,
  type FeedCardProps,
} from "../../../../../packages/ui/feed";
import { PixelBadge, PixelIcon } from "./PixelKit";
import { usePixelTheme } from "./pixelTheme";
import { PixelAvatar } from "./PixelKit";
const bootstrap = require("../../../../../tools/applications/bootstrap.json");

/** Host fallback only: applications retain ownership of registered cards. */
export function PixelPostFrame(card: FeedCardProps) {
  const { colors } = usePixelTheme();
  const Avatar = card.friend.Avatar;
  return (
    <View style={{ padding: 8, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <Pressy
          accessibilityLabel={`打开${card.friend.name}`}
          onPress={card.onOpen}
          style={{
            width: 44,
            height: 44,
            borderWidth: 2,
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
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          borderTopWidth: 1,
          borderTopColor: colors.line,
          paddingTop: 2,
        }}
      >
        <Pressy
          accessibilityLabel={`对${card.friend.name}说一句`}
          onPress={card.onReply}
          style={{ flexDirection: "row", gap: 3 }}
        >
          <PixelIcon name="chat" size={16} color={colors.ink3} />
          <Text style={{ color: colors.ink3, fontSize: 12 }}>对 TA 说</Text>
        </Pressy>
        <Pressy
          accessibilityLabel={card.liked ? "取消喜欢" : "喜欢"}
          accessibilityState={{ selected: card.liked }}
          onPress={card.onLike}
          style={{ flexDirection: "row", gap: 3 }}
        >
          <PixelIcon
            name="heart"
            size={16}
            color={card.liked ? colors.redText : colors.ink3}
          />
          <Text
            style={{
              color: card.liked ? colors.redText : colors.ink3,
              fontSize: 12,
            }}
          >
            {card.liked ? "已喜欢" : "喜欢"}
          </Text>
        </Pressy>
        <Pressy
          accessibilityLabel={`打开${card.friend.name}`}
          onPress={card.onOpen}
          style={{ flexDirection: "row", gap: 3 }}
        >
          <Text
            style={{
              color: colors.accentText,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            打开应用
          </Text>
          <PixelIcon name="arrow" size={12} color={colors.accentText} />
        </Pressy>
      </View>
    </View>
  );
}
