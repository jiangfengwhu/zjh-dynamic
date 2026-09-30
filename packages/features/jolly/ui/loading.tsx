import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { theme, themedStyleSheet, useTheme } from "@zijinhua/app-sdk/ui";

export type JollyLoadingProps = {
  size?: "sm" | "md" | "lg";
  color?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export function JollyLoading({
  size = "md",
  color,
  label,
  style,
}: JollyLoadingProps) {
  const { colors } = useTheme();
  const dotColor = color ?? colors.accent;

  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createBounce = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, {
            toValue: -1,
            duration: 320,
            easing: Easing.bezier(0.33, 1, 0.68, 1),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 320,
            easing: Easing.bezier(0.32, 0, 0.67, 0),
            useNativeDriver: true,
          }),
          Animated.delay(Math.max(0, 480 - delay)),
        ])
      );
    };

    const b1 = createBounce(anim1, 0);
    const b2 = createBounce(anim2, 140);
    const b3 = createBounce(anim3, 280);

    b1.start();
    b2.start();
    b3.start();

    return () => {
      b1.stop();
      b2.stop();
      b3.stop();
    };
  }, [anim1, anim2, anim3]);

  const dotSize = size === "sm" ? 5 : size === "lg" ? 9 : 7;
  const bounceDist = size === "sm" ? 4 : size === "lg" ? 7 : 5.5;
  const dotGap = size === "sm" ? 3.5 : size === "lg" ? 6 : 5;

  const renderDot = (anim: Animated.Value) => (
    <Animated.View
      style={[
        {
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: dotColor,
        },
        {
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [-1, 0],
                outputRange: [-bounceDist, 0],
              }),
            },
            {
              scale: anim.interpolate({
                inputRange: [-1, 0],
                outputRange: [1.18, 0.9],
              }),
            },
          ],
          opacity: anim.interpolate({
            inputRange: [-1, 0],
            outputRange: [1, 0.55],
          }),
        },
      ]}
    />
  );

  return (
    <View style={[styles.container, size === "lg" && styles.containerLg, style]}>
      {size === "lg" ? (
        <View style={styles.sparkleWrap}>
          <Text style={[styles.sparkleIcon, { color: dotColor }]}>✦</Text>
        </View>
      ) : null}
      <View style={[styles.dotsRow, { gap: dotGap }]}>
        {renderDot(anim1)}
        {renderDot(anim2)}
        {renderDot(anim3)}
      </View>
      {label ? (
        <Text style={[styles.label, size === "sm" && styles.labelSm]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  containerLg: {
    flexDirection: "column",
    gap: 12,
    paddingVertical: 20,
  },
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 18,
  },
  sparkleWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  sparkleIcon: {
    fontSize: 16,
    fontWeight: "800",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.ink2,
  },
  labelSm: {
    fontSize: 11,
  },
}));
