import { useEffect, useRef } from "react";
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type SkeletonProps = {
  animated?: boolean;
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({
  animated = true,
  width = "100%",
  height = 16,
  borderRadius = theme.radius.sm,
  style,
}: SkeletonProps) {
  useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!animated) {
      opacity.setValue(0.35);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, animated]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

const styles = themedStyleSheet(() => ({
  base: {
    backgroundColor: theme.hover,
  },
}));
