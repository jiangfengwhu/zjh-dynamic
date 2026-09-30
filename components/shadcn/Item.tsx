import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function ItemGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

export function Item({
  variant = "default",
  children,
  style,
}: {
  variant?: "default" | "outline" | "muted";
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.item,
        { backgroundColor: variant === "muted" ? colors.inset : colors.surfaceRaised },
        variant === "outline" && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineStrong },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ItemMedia({ children }: { children: ReactNode }) {
  return <View style={styles.media}>{children}</View>;
}

export function ItemContent({ children }: { children: ReactNode }) {
  return <View style={styles.content}>{children}</View>;
}

export function ItemTitle({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.title, { color: colors.text }]}>{children}</Text>;
}

export function ItemDescription({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[styles.desc, { color: colors.muted }]}>{children}</Text>;
}

export function ItemActions({ children }: { children: ReactNode }) {
  return <View style={styles.actions}>{children}</View>;
}

export function ItemSeparator() {
  return <View style={styles.sep} />;
}

const styles = themedStyleSheet(() => ({
  group: {
    gap: 6,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    minHeight: 48,
  },
  itemOutline: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  itemMuted: {
    backgroundColor: theme.inset,
  },
  media: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    backgroundColor: theme.inset,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "600",
  },
  desc: {
    color: theme.muted,
    fontSize: 13,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.line,
  },
}));
