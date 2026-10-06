import { StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { Button } from "tamagui";
import { useTheme } from "../theme";
import { useReducedMotion } from "react-native-reanimated";
import type { ReactNode } from "react";

export type PressyProps = Omit<PressableProps, "style" | "children"> & { children?: ReactNode; style?: StyleProp<ViewStyle>; scale?: number };
/** Host action styling; gestures and interaction belong to Tamagui. */
export function Pressy({ style, scale = 0.98, children, disabled, accessibilityState, ...rest }: PressyProps) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const flat = StyleSheet.flatten(style);
  const defaults = flat?.backgroundColor === colors.accent ? {
    borderRadius: colors.radius.sm, paddingHorizontal: flat.paddingHorizontal ?? flat.padding ?? 12,
    paddingVertical: flat.paddingVertical ?? flat.padding ?? 8,
  } : undefined;
  return <Button unstyled {...rest} disabled={disabled} accessibilityRole={rest.accessibilityRole ?? "button"}
    accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled || accessibilityState?.disabled) }}
    minHeight={44} minWidth={44} justifyContent="center" flexDirection="column"
    pressStyle={{ opacity: 0.78, scale: reduced ? 1 : Math.max(0.9, Math.min(1, scale)) }}
    style={[defaults, style, disabled && { opacity: 0.45 }]}>{children}</Button>;
}
