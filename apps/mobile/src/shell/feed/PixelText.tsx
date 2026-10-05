import { forwardRef, type ComponentRef } from "react";
import { Text, type TextProps } from "react-native";
import { useTheme } from "../../../../../packages/ui/theme";

/** APK 1.4 registers this font. Native text preserves selection, inline links,
 * wrapping, accessibility and system font scaling. */
export const PixelText = forwardRef<
  ComponentRef<typeof Text>,
  TextProps & { pixel?: boolean }
>(function PixelText({ style, pixel, ...props }, ref) {
  const { colors } = useTheme();
  const enabled = pixel ?? true;
  return (
    <Text
      {...props}
      ref={ref}
      style={[
        { color: colors.ink1 },
        style,
        enabled && {
          fontFamily: "Fusion Pixel 12px Proportional SC",
          fontWeight: "normal",
          fontStyle: "normal",
        },
      ]}
    />
  );
});
