import { UserAvatar, defaultAvatarSource } from "../UserAvatar";
import { memo } from "react";
import { View } from "react-native";
import { PixelText as Text } from "./PixelText";

export {
  SymbolIcon,
  type IconSymbol,
} from "../../../../../packages/ui/chrome/SymbolIcon";

export const mascotImage = defaultAvatarSource;
export const PixelAvatar = memo(function PixelAvatar({ size = 48 }: { size?: number }) {
  return <UserAvatar size={size} />;
});

export function PixelBadge({
  label,
  color,
  background,
}: {
  label: string;
  color: string;
  background: string;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        backgroundColor: background,
      }}
    >
      <Text style={{ fontSize: 10, lineHeight: 15, fontWeight: "700", color }}>
        {label}
      </Text>
    </View>
  );
}
