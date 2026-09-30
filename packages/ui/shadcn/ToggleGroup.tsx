import { createContext, useContext, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

type ToggleGroupContextValue = {
  values: string[];
  toggleValue: (v: string) => void;
};

const ToggleGroupContext = createContext<ToggleGroupContextValue>({
  values: [],
  toggleValue: () => {},
});

export type ToggleGroupProps = {
  type?: "single" | "multiple";
  value: string | string[];
  onValueChange: (next: string | string[]) => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ToggleGroup({
  type = "single",
  value,
  onValueChange,
  children,
  style,
}: ToggleGroupProps) {
  useTheme();
  const values = Array.isArray(value) ? value : value ? [value] : [];

  const toggleValue = (val: string) => {
    if (type === "single") {
      onValueChange(values.includes(val) ? "" : val);
    } else {
      onValueChange(
        values.includes(val) ? values.filter((x) => x !== val) : [...values, val],
      );
    }
  };

  return (
    <ToggleGroupContext.Provider value={{ values, toggleValue }}>
      <View style={[styles.group, style]}>{children}</View>
    </ToggleGroupContext.Provider>
  );
}

export function ToggleGroupItem({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  useTheme();
  const { values, toggleValue } = useContext(ToggleGroupContext);
  const selected = values.includes(value);

  return (
    <Pressable
      onPress={() => toggleValue(value)}
      style={[styles.item, selected && styles.itemSelected]}
    >
      {typeof children === "string" ? (
        <Text style={[styles.text, selected && styles.textSelected]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = themedStyleSheet(() => ({
  group: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.inset,
    borderRadius: theme.radius.md,
    padding: 2,
    gap: 2,
    alignSelf: "flex-start",
  },
  item: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
  },
  itemSelected: {
    backgroundColor: theme.surfaceRaised,
  },
  text: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  textSelected: {
    color: theme.text,
    fontWeight: "600",
  },
}));
