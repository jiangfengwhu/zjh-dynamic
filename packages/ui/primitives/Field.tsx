import { useId, type ReactNode } from "react";
import { View, type ViewProps } from "react-native";
import { useTheme } from "../theme";
import { Text } from "./Typography";

export type FieldProps = ViewProps & { label?: string; hint?: string; error?: string; children: ReactNode; labelId?: string };
export function Field({ label, hint, error, children, labelId, style, ...props }: FieldProps) {
  const { colors } = useTheme();
  const id = useId();
  return <View {...props} style={[{ gap: 6 }, style]}>
    {label ? <Text nativeID={labelId ?? id} variant="caption" style={{ color: colors.ink2, fontWeight: "600" }}>{label}</Text> : null}
    {children}
    {error ? <Text variant="caption" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.redText }}>{error}</Text>
      : hint ? <Text variant="caption" style={{ color: colors.ink3 }}>{hint}</Text> : null}
  </View>;
}
