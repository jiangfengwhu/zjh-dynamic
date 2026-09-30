import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function NavigationMenu({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.nav, style]}>{children}</View>;
}

export function NavigationMenuList({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.list}>{children}</View>;
}

export function NavigationMenuItem({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  useTheme();
  const [open, setOpen] = useState(false);
  if (!title) return <View>{children}</View>;
  return (
    <View style={styles.item}>
      <NavigationMenuTrigger onPress={() => setOpen((o) => !o)}>
        {title}
      </NavigationMenuTrigger>
      {open ? <NavigationMenuContent>{children}</NavigationMenuContent> : null}
    </View>
  );
}

export function NavigationMenuTrigger({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.trigger}>
      <Text style={styles.triggerText}>{children}</Text>
      <Text style={styles.chevron}>▾</Text>
    </Pressable>
  );
}

export function NavigationMenuContent({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.content}>{children}</View>;
}

export function NavigationMenuLink({
  title,
  description,
  onPress,
}: {
  title: string;
  description?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.link}>
      <Text style={styles.linkTitle}>{title}</Text>
      {description ? <Text style={styles.linkDesc}>{description}</Text> : null}
    </Pressable>
  );
}

const styles = themedStyleSheet(() => ({
  nav: {
    gap: 6,
  },
  list: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  item: {
    gap: 4,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  triggerText: {
    color: theme.text,
    fontSize: 12.5,
    fontWeight: "500",
  },
  chevron: {
    color: theme.muted,
    fontSize: 10,
  },
  content: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 8,
    gap: 4,
  },
  link: {
    padding: 6,
    borderRadius: theme.radius.xs,
    gap: 2,
  },
  linkTitle: {
    color: theme.text,
    fontSize: 12.5,
    fontWeight: "600",
  },
  linkDesc: {
    color: theme.muted,
    fontSize: 11.5,
  },
}));
