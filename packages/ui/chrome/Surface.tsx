import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme";

export type SurfaceTone = "base" | "raised" | "inset";

/** 同一个颜色把透明度归零，渐变才不会经过一段灰。 */
export function clear(color: string): string {
  return color.replace(/[\d.]+\)\s*$/, "0)");
}

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
          borderWidth: StyleSheet.hairlineWidth,
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

/** 中性的细分隔线；保留公开组件名，插件无需改导入。 */
export function GiltLine({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }, style]} />
  );
}
