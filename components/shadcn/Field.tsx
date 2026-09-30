import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function FieldSet({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.fieldset, style]}>{children}</View>;
}

export function FieldLegend({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.legend}>{children}</Text>;
}

export function FieldGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.group, style]}>{children}</View>;
}

export function Field({
  orientation = "vertical",
  children,
  style,
}: {
  orientation?: "vertical" | "horizontal";
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  return (
    <View
      style={[
        styles.field,
        orientation === "horizontal" && styles.fieldHorizontal,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.label}>{children}</Text>;
}

export function FieldDescription({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.desc}>{children}</Text>;
}

export function FieldError({ children }: { children?: ReactNode }) {
  useTheme();
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

const styles = themedStyleSheet(() => ({
  fieldset: {
    gap: 12,
  },
  legend: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  group: {
    gap: 12,
  },
  field: {
    gap: 6,
  },
  fieldHorizontal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  error: {
    color: theme.redText,
    fontSize: 11.5,
  },
}));
