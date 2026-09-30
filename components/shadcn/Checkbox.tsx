import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Checkbox({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  style,
}: CheckboxProps) {
  useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      style={[styles.row, disabled && styles.disabled, style]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Text style={styles.check}>✓</Text> : null}
      </View>
      {label || description ? (
        <View style={styles.textWrap}>
          {label ? <Text style={styles.label}>{label}</Text> : null}
          {description ? <Text style={styles.desc}>{description}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = themedStyleSheet(() => ({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    backgroundColor: theme.field,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxChecked: {
    backgroundColor: theme.text,
    borderColor: theme.text,
  },
  check: {
    color: theme.ink,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 14,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: theme.text,
    fontSize: 13.5,
    fontWeight: "500",
  },
  desc: {
    color: theme.muted,
    fontSize: 12,
  },
  disabled: {
    opacity: 0.4,
  },
}));
