import { Image, View } from "react-native";
import { PixelText as Text } from "./PixelText";
import { pixelAssets } from "./pixelAssets";

export {
  PixelIcon,
  type PixelSymbol,
} from "../../../../../packages/ui/chrome/PixelIcon";

export const mascotImage = {
  uri: `data:image/png;base64,${pixelAssets.avatar.base64}`,
};
export function PixelAvatar({ size = 48 }: { size?: number }) {
  return (
    <Image
      accessible={false}
      source={mascotImage}
      resizeMode="contain"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#FFFFFF",
      }}
    />
  );
}

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
