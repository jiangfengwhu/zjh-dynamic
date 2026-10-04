import { pixelTheme, usePixelTheme } from "../pixelTheme";
import { PixelIcon } from "../chrome/PixelIcon";
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
import { themedStyleSheet, useTheme } from "../theme";

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
  const { colors } = usePixelTheme();
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
        <PixelIcon name="down" size={14} color={colors.ink3} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={styles.popover}
            onPress={(e) => e.stopPropagation()}
          >
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.ink3}
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
                    <View style={{ width: 14 }}>
                      {isSelected ? (
                        <PixelIcon
                          name="check"
                          size={14}
                          color={colors.accentText}
                        />
                      ) : null}
                    </View>
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

const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    trigger: {
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: t.radius.md,
      backgroundColor: t.field,
      borderWidth: 0.5,
      borderColor: t.lineStrong,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    triggerText: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 13.5,
    },
    placeholder: {
      color: t.ink3,
    },
    chevron: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 12,
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(25,21,44,0.46)",
      justifyContent: "center",
      padding: 24,
    },
    popover: {
      backgroundColor: t.canvas,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: t.lineStrong,
      padding: 6,
      gap: 4,
    },
    searchInput: {
      borderBottomWidth: 0.5,
      borderBottomColor: t.line,
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 13,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    empty: {
      color: t.ink3,
      fontFamily: t.mono,
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
      borderRadius: t.radius.sm,
    },
    itemSelected: {
      backgroundColor: t.hover,
    },
    check: {
      width: 14,
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 12,
      fontWeight: "700",
    },
    itemLabel: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 13,
    },
  };
});
