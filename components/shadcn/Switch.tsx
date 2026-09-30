import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { themedStyleSheet, useTheme } from "../theme";

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const TRAVEL = 20;

export function Switch({ checked, onCheckedChange, label, disabled, style }: SwitchProps) {
  const { colors } = useTheme();
  const level = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    level.value = withSpring(checked ? 1 : 0, { damping: 17, stiffness: 300 });
  }, [checked, level]);
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: level.value * TRAVEL }, { scale: interpolate(level.value, [0, 0.5, 1], [1, 1.12, 1]) }],
  }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onCheckedChange(!checked)}
      style={[styles.row, disabled && styles.disabled, style]}
    >
      <View style={[styles.track, checked ? styles.trackOn : styles.trackOff]}>
        <Animated.View
          style={[styles.thumb, { backgroundColor: checked ? colors.onAccent : colors.ink3 }, thumb]}
        />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = themedStyleSheet((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  track: {
    width: 46,
    height: 26,
    borderRadius: 999,
    padding: 3,
    justifyContent: "center",
  },
  trackOff: {
    backgroundColor: t.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.lineStrong,
  },
  trackOn: {
    backgroundColor: t.accent,
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  label: {
    color: t.text,
    fontSize: 13,
  },
  disabled: {
    opacity: 0.4,
  },
}));
