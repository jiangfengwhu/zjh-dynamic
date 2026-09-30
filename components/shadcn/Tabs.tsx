import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

type TabsContextValue = {
  value: string;
  onValueChange: (val: string) => void;
};

const TabsContext = createContext<TabsContextValue>({
  value: "",
  onValueChange: () => {},
});

export type TabsProps = {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Tabs({
  defaultValue = "",
  value: controlledValue,
  onValueChange,
  children,
  style,
}: TabsProps) {
  useTheme();
  const [internal, setInternal] = useState(defaultValue);
  const active = controlledValue ?? internal;
  const setValue = (next: string) => {
    setInternal(next);
    onValueChange?.(next);
  };

  return (
    <TabsContext.Provider value={{ value: active, onValueChange: setValue }}>
      <View style={[styles.root, style]}>{children}</View>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  return <View style={[styles.list, style]}>{children}</View>;
}

export function TabsTrigger({
  value,
  children,
  style,
}: {
  value: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  const ctx = useContext(TabsContext);
  const active = ctx.value === value;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => ctx.onValueChange(value)}
      style={[styles.trigger, active && styles.triggerActive, style]}
    >
      <Text style={[styles.triggerText, active && styles.triggerTextActive]}>{children}</Text>
    </Pressable>
  );
}

export function TabsContent({
  value,
  children,
  style,
}: {
  value: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  const ctx = useContext(TabsContext);
  if (ctx.value !== value) return null;
  return <View style={[styles.content, style]}>{children}</View>;
}

const styles = themedStyleSheet(() => ({
  root: {
    gap: 10,
  },
  list: {
    flexDirection: "row",
    backgroundColor: theme.inset,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
  },
  trigger: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerActive: {
    backgroundColor: theme.surfaceRaised,
  },
  triggerText: {
    color: theme.muted,
    fontSize: 12.5,
    fontWeight: "500",
  },
  triggerTextActive: {
    color: theme.text,
    fontWeight: "600",
  },
  content: {
    paddingTop: 2,
  },
}));
