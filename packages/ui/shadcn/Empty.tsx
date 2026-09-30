import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function Empty({
  title = "No data found",
  description,
  icon = "∅",
  children,
  style,
}: {
  title?: string;
  description?: string;
  icon?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  return (
    <View style={[styles.box, style]}>
      <View style={styles.iconWrap}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.desc}>{description}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

export function EmptyHeader({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.header}>{children}</View>;
}

export function EmptyTitle({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.title}>{children}</Text>;
}

export function EmptyDescription({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.desc}>{children}</Text>;
}

export function EmptyContent({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.actions}>{children}</View>;
}

const styles = themedStyleSheet(() => ({
  box: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: theme.lineStrong,
    backgroundColor: theme.surface,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 6,
  },
  header: {
    alignItems: "center",
    gap: 4,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: theme.inset,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  iconText: {
    color: theme.muted,
    fontSize: 16,
  },
  title: {
    color: theme.text,
    fontSize: 14.5,
    fontWeight: "600",
    textAlign: "center",
  },
  desc: {
    color: theme.muted,
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
  },
  actions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
}));
