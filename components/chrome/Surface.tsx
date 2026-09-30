import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import LinearGradient from "react-native-linear-gradient";
import { useTheme } from "../theme";

export type SurfaceTone = "base" | "raised" | "inset";

/** 同一个颜色把透明度归零，渐变才不会经过一段灰。 */
export function clear(color: string): string {
  return color.replace(/[\d.]+\)\s*$/, "0)");
}

/**
 * 有厚度的面。顶沿一道高光，往下渐渐没入底色，边框是发丝线。
 * 卡片、分组列表、输入框的底都用它，整个应用的"材质"只有这一处。
 */
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
          borderColor: tone === "inset" ? colors.line : colors.lineStrong,
          overflow: "hidden",
        },
        lifted && {
          shadowColor: "#000",
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        },
        style,
      ]}
    >
      {tone === "inset" ? null : (
        <LinearGradient
          pointerEvents="none"
          colors={[colors.sheen, clear(colors.sheen)]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.sheen}
        />
      )}
      {children}
    </View>
  );
}

/** 一条两头渐隐的金线，只用在少数需要"收边"的位置。 */
export function GiltLine({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[clear(colors.accentSoft), colors.accentSoft, clear(colors.accentSoft)]}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
      style={[{ height: StyleSheet.hairlineWidth * 2 }, style]}
    />
  );
}

const styles = StyleSheet.create({
  sheen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 56,
  },
});
