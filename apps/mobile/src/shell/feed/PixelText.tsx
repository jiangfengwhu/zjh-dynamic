import { Text, type TextProps } from "react-native";
import { useTheme } from "../../../../../packages/ui/theme";

/** APK 1.4 registers this font. Native text preserves selection, inline links,
 * wrapping, accessibility and system font scaling. */
export function PixelText({ style, pixel, ...props }: TextProps & { pixel?: boolean }) {
  const { colors } = useTheme();
  const enabled = pixel ?? (colors.canvas === "#171322" || colors.canvas === "#F1EDF8");
  return <Text {...props} style={[{ color: colors.ink1 }, style, enabled && {
    fontFamily: "Fusion Pixel 12px Proportional SC", fontWeight: "normal", fontStyle: "normal",
  }]} />;
}
