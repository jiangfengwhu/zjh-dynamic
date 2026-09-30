import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type RadioOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
};

export type RadioGroupProps<T extends string = string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: RadioOption<T>[];
  style?: StyleProp<ViewStyle>;
};

export function RadioGroup<T extends string = string>({
  value,
  onValueChange,
  options,
  style,
}: RadioGroupProps<T>) {
  useTheme();
  return (
    <View style={[styles.group, style]}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onValueChange(opt.value)}
            style={styles.item}
          >
            <View style={[styles.outer, selected && styles.outerSelected]}>
              {selected ? <View style={styles.inner} /> : null}
            </View>
            <View style={styles.textWrap}>
              <Text style={styles.label}>{opt.label}</Text>
              {opt.description ? <Text style={styles.desc}>{opt.description}</Text> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  group: {
    gap: 10,
  },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  outer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    backgroundColor: theme.field,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  outerSelected: {
    borderColor: theme.text,
  },
  inner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: theme.text,
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
}));
