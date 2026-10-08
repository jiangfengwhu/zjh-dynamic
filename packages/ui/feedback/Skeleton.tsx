import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { createThemedStyles, useTheme } from "../theme";

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
  borderRadius,
  style,
}: SkeletonProps) {
  const styles = useStyles();

  const { colors } = useTheme();
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReducedMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducedMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!animated || reducedMotion) {
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
  }, [opacity, animated, reducedMotion]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width, height, borderRadius: borderRadius ?? colors.radius.sm, opacity },
        style,
      ]}
    />
  );
}

const useStyles = createThemedStyles((theme) => ({
  base: {
    backgroundColor: theme.surfaceRaised,
  },
}));
