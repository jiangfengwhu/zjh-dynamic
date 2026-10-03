import { Image, View } from "react-native";
import { PixelText as Text } from "./PixelText";
import Svg, { Path } from "react-native-svg";
import { pixelAssets } from "./pixelAssets";

export type PixelSymbol =
  | "plus"
  | "bell"
  | "heart"
  | "chat"
  | "arrow"
  | "spark"
  | "feed"
  | "box"
  | "mine";
const paths: Record<PixelSymbol, string> = {
  plus: "M7 2h2v5h5v2H9v5H7V9H2V7h5z",
  bell: "M6 1h4v2h2v2h1v6h2v2H1v-2h2V5h1V3h2zM5 5v6h6V5H9V3H7v2zM6 14h4v2H6z",
  heart: "M2 3h4v2h4V3h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V5h2z",
  chat: "M1 2h14v10H7l-4 3v-3H1zM3 4v6h2v2l2-2h6V4z",
  arrow: "M8 1h2v2h2v2h2v2h2v2h-2v2h-2v2h-2v2H8v-4h2V9H0V7h10V5H8z",
  spark: "M7 0h2v5h2v2h5v2h-5v2H9v5H7v-5H5V9H0V7h5V5h2z",
  feed: "M1 1h14v14H1zM3 3v10h10V3zM5 5h6v2H5zM5 9h4v2H5z",
  box: "M2 2h12v3h2v10H0V5h2zM4 4v2h8V4zM2 8v5h12V8h-4v2H6V8z",
  mine: "M5 1h6v2h2v6h-2v2h3v2h2v3H0v-3h2v-2h3V9H3V3h2zM5 3v6h6V3zM4 13v1h8v-1z",
};
export function PixelIcon({
  name,
  size = 20,
  color,
}: {
  name: PixelSymbol;
  size?: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" accessible={false}>
      <Path d={paths[name]} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export const mascotImage = {
  uri: `data:image/png;base64,${pixelAssets.avatar.base64}`,
};
export function PixelAvatar({ size = 48 }: { size?: number }) {
  return (
    <Image
      accessible={false}
      source={mascotImage}
      resizeMode="contain"
      style={{ width: size, height: size, backgroundColor: "#FFFFFF" }}
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
