import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type AlertVariant = "default" | "destructive" | "warning" | "success";

export type AlertProps = {
  variant?: AlertVariant;
  title?: string;
  description?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Alert({
  variant = "default",
  title,
  description,
  children,
  style,
}: AlertProps) {
  useTheme();
  return (
    <View style={[styles.base, styles[variant], style]}>
      {title ? (
        <Text style={[styles.title, variant === "destructive" && styles.destructiveText]}>
          {title}
        </Text>
      ) : null}
      {description ? (
        <Text style={[styles.desc, variant === "destructive" && styles.destructiveText]}>
          {description}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function AlertTitle({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.title}>{children}</Text>;
}

export function AlertDescription({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.desc}>{children}</Text>;
}

const styles = themedStyleSheet(() => ({
  base: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  default: {
    backgroundColor: theme.surfaceRaised,
    borderColor: theme.lineStrong,
  },
  destructive: {
    backgroundColor: theme.redTint,
    borderColor: theme.red,
  },
  warning: {
    backgroundColor: theme.orangeTint,
    borderColor: theme.orange,
  },
  success: {
    backgroundColor: theme.greenTint,
    borderColor: theme.green,
  },
  title: {
    color: theme.text,
    fontSize: 13.5,
    fontWeight: "600",
  },
  desc: {
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  destructiveText: {
    color: theme.redText,
  },
}));
