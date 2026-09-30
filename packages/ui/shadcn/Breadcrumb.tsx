import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function Breadcrumb({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return (
    <View accessibilityRole="header" style={[styles.nav, style]}>
      {children}
    </View>
  );
}

export function BreadcrumbList({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.list, style]}>{children}</View>;
}

export function BreadcrumbItem({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.item, style]}>{children}</View>;
}

export function BreadcrumbLink({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Text style={styles.link}>{children}</Text>
    </Pressable>
  );
}

export function BreadcrumbPage({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.page}>{children}</Text>;
}

export function BreadcrumbSeparator({ children = "/" }: { children?: ReactNode }) {
  useTheme();
  return <Text style={styles.sep}>{children}</Text>;
}

export function BreadcrumbEllipsis() {
  useTheme();
  return <Text style={styles.sep}>•••</Text>;
}

const styles = themedStyleSheet(() => ({
  nav: {
    flexDirection: "row",
    alignItems: "center",
  },
  list: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  link: {
    color: theme.muted,
    fontSize: 12.5,
  },
  page: {
    color: theme.text,
    fontSize: 12.5,
    fontWeight: "600",
  },
  sep: {
    color: theme.ink3,
    fontSize: 12,
  },
}));
