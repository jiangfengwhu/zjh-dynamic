import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { EdgeModal as Modal } from "../edge";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type ComboboxOption = {
  value: string;
  label: string;
};

export type ComboboxProps = {
  options: ComboboxOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  style?: StyleProp<ViewStyle>;
};

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select item…",
  searchPlaceholder = "Search…",
  emptyText = "No item found.",
  style,
}: ComboboxProps) {
  useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <View style={style}>
      <Pressable onPress={() => setOpen(true)} style={styles.trigger}>
        <Text style={[styles.triggerText, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.chevron}>⇕</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.popover} onPress={(e) => e.stopPropagation()}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={theme.ink3}
              style={styles.searchInput}
            />
            {filtered.length === 0 ? (
              <Text style={styles.empty}>{emptyText}</Text>
            ) : (
              filtered.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      onValueChange?.(opt.value);
                      setOpen(false);
                    }}
                    style={[styles.item, isSelected && styles.itemSelected]}
                  >
                    <Text style={styles.check}>{isSelected ? "✓" : " "}</Text>
                    <Text style={styles.itemLabel}>{opt.label}</Text>
                  </Pressable>
                );
              })
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
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
    padding: 24,
  },
  popover: {
    backgroundColor: theme.surfaceRaised,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 6,
    gap: 4,
  },
  searchInput: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
    color: theme.text,
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  empty: {
    color: theme.muted,
    fontSize: 12.5,
    textAlign: "center",
    paddingVertical: 14,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  itemSelected: {
    backgroundColor: theme.hover,
  },
  check: {
    width: 14,
    color: theme.text,
    fontSize: 12,
    fontWeight: "700",
  },
  itemLabel: {
    color: theme.text,
    fontSize: 13,
  },
}));
