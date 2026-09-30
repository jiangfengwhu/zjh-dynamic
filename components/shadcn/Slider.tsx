import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type SliderProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
  onValueChange: (value: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  label,
  unit = "",
  onValueChange,
  style,
}: SliderProps) {
  useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));

  const handleLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const handlePress = (locationX: number) => {
    if (trackWidth <= 0) return;
    const raw = min + (locationX / trackWidth) * (max - min);
    const stepped = Math.round(raw / step) * step;
    const clamped = Math.max(min, Math.min(max, stepped));
    onValueChange(clamped);
  };

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <View style={styles.header}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.val}>
            {value}
            {unit}
          </Text>
        </View>
      ) : null}
      <Pressable
        onLayout={handleLayout}
        onPress={(e) => handlePress(e.nativeEvent.locationX)}
        style={styles.hitArea}
      >
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        </View>
        <View style={[styles.thumb, { left: `${ratio * 100}%` }]} />
      </Pressable>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  wrap: {
    gap: 6,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: theme.ink2,
    fontSize: 12,
  },
  val: {
    color: theme.text,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  hitArea: {
    height: 24,
    justifyContent: "center",
    position: "relative",
  },
  track: {
    height: 5,
    borderRadius: 999,
    backgroundColor: theme.inset,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: theme.text,
  },
  thumb: {
    position: "absolute",
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: theme.text,
    borderWidth: 2,
    borderColor: theme.ink,
  },
}));
