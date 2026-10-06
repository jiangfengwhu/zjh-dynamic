import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme";

export type SurfaceTone = "base" | "raised" | "inset";

/** 信息面平整，仅 lifted 弹层使用阴影。 */
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
  const background = tone === "raised" ? colors.surfaceRaised : tone === "inset" ? colors.inset : colors.surface;
  const round = radius ?? colors.radius.lg;
  return (
    <View
      style={[
        {
          backgroundColor: background,
          borderRadius: round,
          borderWidth: colors.components.surfaceBorder,
          borderColor: colors.line,
          overflow: "hidden",
        },
        lifted && {
          boxShadow: `0 8px 24px ${colors.shade}`,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
