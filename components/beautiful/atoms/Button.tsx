import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme, themedStyleSheet, useTheme } from "../../theme";

export type BeautifulButtonVariant = "primary" | "secondary" | "accent" | "ghost" | "danger";
export type BeautifulButtonSize = "sm" | "md";

export type BeautifulButtonProps = Omit<PressableProps, "style"> & {
  variant?: BeautifulButtonVariant;
  size?: BeautifulButtonSize;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function BeautifulButton({
  variant = "primary",
  size = "md",
  disabled,
  style,
  children,
  ...rest
}: BeautifulButtonProps) {
  useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        size === "sm" ? styles.sm : styles.md,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      {...rest}
    >
      {typeof children === "string" ? (
        <Text
          style={[
            styles.text,
            size === "sm" && styles.textSm,
            variant === "primary" && styles.textPrimary,
            (variant === "accent" || variant === "danger") && styles.textWhite,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export { BeautifulButton as Button };

const styles = themedStyleSheet(() => ({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: theme.radius.pill,
  },
  sm: {
    height: 27,
    paddingHorizontal: 10,
  },
  md: {
    height: 32,
    paddingHorizontal: 13,
  },
  primary: {
    backgroundColor: theme.text,
  },
  secondary: {
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  accent: {
    backgroundColor: theme.accent,
  },
  danger: {
    backgroundColor: theme.red,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    color: theme.text,
    fontSize: 12.5,
    fontWeight: "600",
  },
  textSm: {
    fontSize: 12,
  },
  textPrimary: {
    color: theme.ink,
  },
  textWhite: {
    color: theme.onAccent,
  },
}));
