import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type ToggleVariant = "default" | "outline";
export type ToggleSize = "default" | "sm" | "lg";

export type ToggleProps = {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  variant?: ToggleVariant;
  size?: ToggleSize;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Toggle({
  pressed,
  onPressedChange,
  variant = "default",
  size = "default",
  disabled,
  children,
  style,
}: ToggleProps) {
  useTheme();
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityState={{ selected: pressed, disabled }}
      disabled={disabled}
      onPress={() => onPressedChange(!pressed)}
      style={[
        styles.base,
        variant === "outline" && styles.outline,
        size === "sm" && styles.sm,
        size === "lg" && styles.lg,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {typeof children === "string" ? (
        <Text style={[styles.text, pressed && styles.textPressed]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = themedStyleSheet(() => ({
  base: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  outline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  sm: {
    minHeight: 28,
    paddingHorizontal: 8,
  },
  lg: {
    minHeight: 40,
    paddingHorizontal: 14,
  },
  pressed: {
    backgroundColor: theme.hover,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: "500",
  },
  textPressed: {
    color: theme.text,
    fontWeight: "600",
  },
}));
