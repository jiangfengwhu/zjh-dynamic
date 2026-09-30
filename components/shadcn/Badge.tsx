import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type BadgeTone =
  | "default"
  | "secondary"
  | "outline"
  | "success"
  | "danger"
  | "destructive"
  | "warning"
  | "accent";

export type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
  variant?: BadgeTone;
  style?: StyleProp<ViewStyle>;
};

export function Badge({ children, tone, variant, style }: BadgeProps) {
  useTheme();
  const resolved = tone ?? variant ?? "secondary";
  const isDefault = resolved === "default";
  const isDanger = resolved === "danger" || resolved === "destructive";

  return (
    <View
      style={[
        styles.base,
        isDanger ? styles.danger : styles[resolved as Exclude<BadgeTone, "destructive">],
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          isDefault && styles.onDefault,
          resolved === "success" && styles.onSuccess,
          isDanger && styles.onDanger,
          resolved === "warning" && styles.onWarning,
          resolved === "accent" && styles.onAccent,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  base: {
    borderRadius: theme.radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  default: {
    backgroundColor: theme.text,
  },
  secondary: {
    backgroundColor: theme.inset,
  },
  outline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    backgroundColor: "transparent",
  },
  success: {
    backgroundColor: theme.greenTint,
  },
  danger: {
    backgroundColor: theme.redTint,
  },
  warning: {
    backgroundColor: theme.orangeTint,
  },
  accent: {
    backgroundColor: theme.accentTint,
  },
  label: {
    fontSize: 11,
    fontWeight: "600",
    color: theme.ink2,
  },
  onDefault: {
    color: theme.ink,
  },
  onSuccess: {
    color: theme.greenText,
  },
  onDanger: {
    color: theme.redText,
  },
  onWarning: {
    color: theme.orangeText,
  },
  onAccent: {
    color: theme.accentText,
  },
}));
