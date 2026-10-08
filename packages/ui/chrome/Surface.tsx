import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme";

export type SurfaceTone = "base" | "raised" | "inset";

/** 信息面以明度差分层：浅色靠柔和投影，深色靠发丝线；lifted 弹层使用更深的悬浮投影。 */
export function Surface({
  tone = "base",
  radius,
  lifted,
  style,
  children,
}: {
  tone?: SurfaceTone;
  radius?: number;
  /** 需要浮起来的面（弹层、悬浮条）才打开。 */
  lifted?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const background = tone === "raised" ? (lifted ? colors.surface : colors.surfaceRaised) : tone === "inset" ? colors.inset : colors.surface;
  const round = radius ?? colors.radius.lg;
  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: round,
          borderWidth: colors.mode === "dark" || lifted ? colors.components.surfaceBorder : 0,
          borderColor: colors.line,
          overflow: "hidden",
        },
        tone === "base" && !lifted && { boxShadow: colors.shadow.card },
        lifted && { boxShadow: colors.shadow.modal },
        style,
      ]}
    >
      {children}
    </View>
  );
}
