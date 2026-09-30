import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { EdgeModal as Modal } from "../edge";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type SelectOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
};

export type SelectProps<T extends string = string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function Select<T extends string = string>({
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  label,
  style,
}: SelectProps<T>) {
  useTheme();
  const [open, setOpen] = useState(false);
  const active = options.find((o) => o.value === value);

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={styles.trigger}>
        <Text style={[styles.triggerText, !active && styles.placeholder]}>
          {active ? active.label : placeholder}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            {options.map((item) => {
              const selected = item.value === value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    onValueChange(item.value);
                    setOpen(false);
                  }}
                  style={[styles.option, selected && styles.optionActive]}
                >
                  <View style={styles.optionBody}>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                    {item.description ? (
                      <Text style={styles.optionDesc}>{item.description}</Text>
                    ) : null}
                  </View>
                  {selected ? <Text style={styles.check}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  wrap: {
    gap: 6,
  },
  label: {
    color: theme.ink1,
    fontSize: 12.5,
    fontWeight: "500",
  },
  trigger: {
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.field,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  triggerText: {
    color: theme.text,
    fontSize: 13.5,
  },
  placeholder: {
    color: theme.ink3,
  },
  chevron: {
    color: theme.muted,
    fontSize: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  menu: {
    backgroundColor: theme.surfaceRaised,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 6,
    gap: 2,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: theme.radius.md,
  },
  optionActive: {
    backgroundColor: theme.hover,
  },
  optionBody: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    color: theme.text,
    fontSize: 13.5,
    fontWeight: "500",
  },
  optionDesc: {
    color: theme.muted,
    fontSize: 11.5,
  },
  check: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "700",
  },
}));
