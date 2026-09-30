import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { EdgeModal as Modal } from "../edge";
import { Calendar } from "./Calendar";
import { theme, themedStyleSheet, useTheme } from "../theme";

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

  const formatted = picked
    ? picked.toISOString().slice(0, 10)
    : placeholder;

  return (
    <View style={style}>
      <Pressable onPress={() => setOpen(true)} style={styles.trigger}>
        <Text style={styles.icon}>📅</Text>
        <Text style={[styles.text, !picked && styles.placeholder]}>{formatted}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
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
    gap: 8,
  },
  icon: {
    fontSize: 13,
  },
  text: {
    color: theme.text,
    fontSize: 13.5,
    fontVariant: ["tabular-nums"],
  },
  placeholder: {
    color: theme.ink3,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
}));
