import { useEffect, useRef } from "react";
import { Animated, StyleSheet, type StyleProp, type TextStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../../theme";

export type ShimmerProps = {
  children: string;
  active?: boolean;
  style?: StyleProp<TextStyle>;
};

export function Shimmer({ children, active = true, style }: ShimmerProps) {
  useTheme();
  const anim = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (!active) {
      anim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, anim]);

  return (
    <Animated.Text style={[styles.text, { opacity: anim }, style]}>
      {children}
    </Animated.Text>
  );
}

const styles = themedStyleSheet(() => ({
  text: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "500",
  },
}));
