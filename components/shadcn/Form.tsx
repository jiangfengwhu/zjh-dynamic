import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function Form({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.form, style]}>{children}</View>;
}

export function FormField({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.item}>{children}</View>;
}

export function FormItem({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.item, style]}>{children}</View>;
}

export function FormLabel({
  children,
  error,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  useTheme();
  return <Text style={[styles.label, error && styles.errorText]}>{children}</Text>;
}

export function FormControl({ children }: { children: ReactNode }) {
  useTheme();
  return <View>{children}</View>;
}

export function FormDescription({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.desc}>{children}</Text>;
}

export function FormMessage({ children }: { children?: ReactNode }) {
  useTheme();
  if (!children) return null;
  return <Text style={styles.errorText}>{children}</Text>;
}

const styles = themedStyleSheet(() => ({
  form: {
    gap: 14,
  },
  item: {
    gap: 6,
  },
  label: {
    color: theme.ink1,
    fontSize: 12.5,
    fontWeight: "500",
  },
  desc: {
    color: theme.muted,
    fontSize: 11.5,
  },
  errorText: {
    color: theme.redText,
    fontSize: 11.5,
  },
}));
