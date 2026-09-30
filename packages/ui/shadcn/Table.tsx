import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function Table({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={[styles.table, style]}>{children}</View>
    </ScrollView>
  );
}

export function TableHeader({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.header, style]}>{children}</View>;
}

export function TableBody({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.body, style]}>{children}</View>;
}

export function TableRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.row, style]}>{children}</View>;
}

export function TableHead({
  children,
  width = 120,
  style,
}: {
  children: ReactNode;
  width?: number;
  style?: StyleProp<TextStyle>;
}) {
  useTheme();
  return (
    <View style={[styles.cell, { width }]}>
      <Text style={[styles.headText, style]}>{children}</Text>
    </View>
  );
}

export function TableCell({
  children,
  width = 120,
  style,
}: {
  children: ReactNode;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  return (
    <View style={[styles.cell, { width }, style]}>
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={styles.cellText} numberOfLines={1}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  table: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    backgroundColor: theme.surfaceRaised,
    overflow: "hidden",
  },
  header: {
    backgroundColor: theme.inset,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  body: {},
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  headText: {
    color: theme.muted,
    fontSize: 11.5,
    fontWeight: "600",
  },
  cellText: {
    color: theme.text,
    fontSize: 13,
  },
}));
