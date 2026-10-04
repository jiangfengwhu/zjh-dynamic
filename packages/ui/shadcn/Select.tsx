import { pixelTheme, usePixelTheme } from "../pixelTheme";
import { PixelIcon } from "../chrome/PixelIcon";
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
import { themedStyleSheet, useTheme } from "../theme";

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
  const { colors } = usePixelTheme();
  const [open, setOpen] = useState(false);
  const active = options.find((o) => o.value === value);

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={styles.trigger}>
        <Text style={[styles.triggerText, !active && styles.placeholder]}>
          {active ? active.label : placeholder}
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
                  {selected ? (
                    <PixelIcon
                      name="check"
                      size={14}
                      color={colors.accentText}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    wrap: {
      gap: 6,
    },
    label: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 12.5,
      fontWeight: "500",
    },
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
      paddingHorizontal: 24,
    },
    menu: {
      backgroundColor: t.canvas,
      borderRadius: 12,
      borderWidth: 0.5,
      borderColor: t.lineStrong,
      padding: 6,
      gap: 2,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: t.radius.md,
    },
    optionActive: {
      backgroundColor: t.hover,
    },
    optionBody: {
      flex: 1,
      gap: 2,
    },
    optionLabel: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 13.5,
      fontWeight: "500",
    },
    optionDesc: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 11.5,
    },
    check: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 13,
      fontWeight: "700",
    },
  };
});
