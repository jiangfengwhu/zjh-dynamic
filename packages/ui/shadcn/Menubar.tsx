import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type MenubarMenuData = {
  label: string;
  items: { label: string; shortcut?: string; onPress?: () => void }[];
};

export function Menubar({
  menus,
  children,
  style,
}: {
  menus?: MenubarMenuData[];
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.bar}>
        {menus
          ? menus.map((m, idx) => (
              <Pressable
                key={m.label}
                onPress={() => setOpenIdx(openIdx === idx ? null : idx)}
                style={[styles.trigger, openIdx === idx && styles.triggerActive]}
              >
                <Text style={styles.triggerText}>{m.label}</Text>
              </Pressable>
            ))
          : children}
      </View>

      {menus && openIdx !== null && menus[openIdx] ? (
        <View style={styles.dropdown}>
          {menus[openIdx].items.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => {
                item.onPress?.();
                setOpenIdx(null);
              }}
              style={styles.item}
            >
              <Text style={styles.itemText}>{item.label}</Text>
              {item.shortcut ? <Text style={styles.shortcut}>{item.shortcut}</Text> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function MenubarMenu({ children }: { children: ReactNode }) {
  useTheme();
  return <View>{children}</View>;
}

export function MenubarTrigger({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.trigger}>
      <Text style={styles.triggerText}>{children}</Text>
    </Pressable>
  );
}

export function MenubarContent({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.dropdown}>{children}</View>;
}

export function MenubarItem({
  children,
  shortcut,
  onPress,
}: {
  children: ReactNode;
  shortcut?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.item}>
      <Text style={styles.itemText}>{children}</Text>
      {shortcut ? <Text style={styles.shortcut}>{shortcut}</Text> : null}
    </Pressable>
  );
}

export function MenubarSeparator() {
  useTheme();
  return <View style={styles.sep} />;
}

export function MenubarShortcut({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.shortcut}>{children}</Text>;
}

const styles = themedStyleSheet(() => ({
  wrap: {
    gap: 4,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  trigger: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.xs,
  },
  triggerActive: {
    backgroundColor: theme.hover,
  },
  triggerText: {
    color: theme.text,
    fontSize: 12.5,
    fontWeight: "500",
  },
  dropdown: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 5,
    gap: 2,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.radius.xs,
  },
  itemText: {
    color: theme.text,
    fontSize: 12.5,
  },
  shortcut: {
    color: theme.muted,
    fontSize: 11,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.line,
    marginVertical: 3,
  },
}));
