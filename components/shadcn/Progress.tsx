import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type ProgressProps = {
  value: number; // 0..100
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Progress({ value, color = theme.text, style }: ProgressProps) {
  useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.track, style]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  track: {
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.inset,
    overflow: "hidden",
    width: "100%",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
}));
