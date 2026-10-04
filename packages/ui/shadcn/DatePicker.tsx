import { pixelTheme } from "../pixelTheme";
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
import { Calendar } from "./Calendar";
import { themedStyleSheet, useTheme } from "../theme";

export type DatePickerProps = {
  value?: Date;
  onChange?: (date: Date) => void;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
};

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  style,
}: DatePickerProps) {
  useTheme();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Date | undefined>(value);

  const formatted = picked ? picked.toISOString().slice(0, 10) : placeholder;

  return (
    <View style={style}>
      <Pressable onPress={() => setOpen(true)} style={styles.trigger}>
        <Text style={styles.icon}>📅</Text>
        <Text style={[styles.text, !picked && styles.placeholder]}>
          {formatted}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <Calendar
              selected={picked}
              onSelect={(d) => {
                setPicked(d);
                onChange?.(d);
                setOpen(false);
              }}
            />
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
      gap: 8,
    },
    icon: {
      fontFamily: t.mono,
      fontSize: 13,
    },
    text: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 13.5,
      fontVariant: ["tabular-nums"],
    },
    placeholder: {
      color: t.ink3,
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(25,21,44,0.46)",
      alignItems: "center",
      justifyContent: "center",
    },
  };
});
