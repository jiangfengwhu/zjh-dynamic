import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function Pagination({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.nav, style]}>{children}</View>;
}

export function PaginationContent({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.list}>{children}</View>;
}

export function PaginationItem({ children }: { children: ReactNode }) {
  useTheme();
  return <View>{children}</View>;
}

export function PaginationLink({
  children,
  isActive,
  onPress,
}: {
  children: ReactNode;
  isActive?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.btn, isActive && styles.btnActive]}
    >
      <Text style={[styles.btnText, isActive && styles.btnTextActive]}>
        {children}
      </Text>
    </Pressable>
  );
}

export function PaginationPrevious({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.navBtn}>
      <Text style={styles.btnText}>‹ Previous</Text>
    </Pressable>
  );
}

export function PaginationNext({ onPress }: { onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.navBtn}>
      <Text style={styles.btnText}>Next ›</Text>
    </Pressable>
  );
}

export function PaginationEllipsis() {
  useTheme();
  return <Text style={styles.ellipsis}>•••</Text>;
}

const styles = themedStyleSheet(() => ({
  nav: {
    alignItems: "center",
  },
  list: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  btn: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  btnActive: {
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  navBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: {
    color: theme.ink2,
    fontSize: 12.5,
    fontWeight: "500",
  },
  btnTextActive: {
    color: theme.text,
    fontWeight: "600",
  },
  ellipsis: {
    color: theme.muted,
    fontSize: 12,
    paddingHorizontal: 4,
  },
}));
