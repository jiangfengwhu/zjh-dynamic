import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link"
  | "accent";

export type ButtonSize = "default" | "sm" | "lg" | "icon";

export type ButtonProps = Omit<PressableProps, "style"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: ReactNode;
};

export function Button({
  variant = "default",
  size = "default",
  label,
  children,
  disabled,
  style,
  textStyle,
  ...rest
}: ButtonProps) {
  useTheme();
  const isLightBg = variant === "default";
  const isAccent = variant === "accent";
  const isDestructive = variant === "destructive";
  const isLink = variant === "link";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        size === "sm" && styles.sm,
        size === "lg" && styles.lg,
        size === "icon" && styles.icon,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {typeof children === "string" || label ? (
        <Text
          style={[
            styles.label,
            size === "sm" && styles.labelSm,
            size === "lg" && styles.labelLg,
            isLightBg && styles.labelOnDefault,
            (isAccent || isDestructive) && styles.labelOnAccent,
            isLink && styles.labelLink,
            textStyle,
          ]}
        >
          {label ?? children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = themedStyleSheet(() => ({
  base: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  default: {
    backgroundColor: theme.text,
  },
  accent: {
    backgroundColor: theme.accent,
  },
  destructive: {
    backgroundColor: theme.red,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  secondary: {
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  link: {
    backgroundColor: "transparent",
    paddingHorizontal: 4,
  },
  sm: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
  },
  lg: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: theme.radius.lg,
  },
  icon: {
    width: 32,
    minHeight: 32,
    paddingHorizontal: 0,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.text,
  },
  labelSm: {
    fontSize: 12,
  },
  labelLg: {
    fontSize: 14,
  },
  labelOnDefault: {
    color: theme.ink,
  },
  labelOnAccent: {
    color: theme.onAccent,
  },
  labelLink: {
    color: theme.accentText,
    textDecorationLine: "underline",
  },
}));
