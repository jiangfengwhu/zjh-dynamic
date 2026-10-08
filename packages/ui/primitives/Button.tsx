import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Pressy, type PressyProps } from "../chrome/Pressy";
import { useTheme } from "../theme";
import { Text } from "./Typography";

export type ButtonProps = Omit<PressyProps, "children"> & { label: string; busy?: boolean; variant?: "solid" | "outline" | "ghost"; intent?: "brand" | "neutral" | "danger" };
export function Button({ label, busy = false, variant = "solid", intent = "brand", disabled, style, ...props }: ButtonProps) {
  const { colors } = useTheme();
  const fill = intent === "danger" ? colors.red : intent === "neutral" ? colors.surfaceRaised : colors.accent;
  const foreground = variant === "solid" ? (intent === "brand" ? colors.onAccent : intent === "danger" ? colors.onDanger : colors.ink1) : intent === "danger" ? colors.redText : colors.ink1;
  return <Pressy {...props} scale={0.96} disabled={disabled || busy} accessibilityLabel={props.accessibilityLabel ?? label}
    accessibilityState={{ ...props.accessibilityState, busy, disabled: Boolean(disabled || busy) }}
    style={[{ minHeight: colors.components.controlHeight, paddingHorizontal: 24, paddingVertical: 12, borderRadius: colors.radius.pill,
      backgroundColor: variant === "solid" ? fill : "transparent", borderWidth: variant === "outline" ? 1 : 0,
      borderColor: intent === "danger" ? colors.red : colors.lineStrong, alignItems: "center", justifyContent: "center" }, style]}>
    <Text style={{ color: foreground, fontSize: 16, lineHeight: 22, fontWeight: "700", letterSpacing: -0.1, opacity: busy ? 0 : 1 }}>{label}</Text>
    {busy ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}><ActivityIndicator color={foreground} /></View> : null}
  </Pressy>;
}
