import { Pressable, StyleSheet, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export type PressyProps = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; scale?: number };

/** Tactile feedback without overriding the caller's size, radius or surface. */
export function Pressy({ style, scale = 0.98, onPressIn, onPressOut, children, disabled, accessibilityState, ...rest }: PressyProps) {
  const { colors } = useTheme();
  const flat = StyleSheet.flatten(style);
  // Older SDK consumers supply only the accent fill. Keep safe defaults, but
  // explicit caller spacing and radius always win, including shorthand padding.
  const primaryDefaults = flat?.backgroundColor === colors.accent ? {
    borderRadius: colors.radius.sm,
    paddingHorizontal: flat.paddingHorizontal ?? flat.padding ?? 12,
    paddingVertical: flat.paddingVertical ?? flat.padding ?? 8,
  } : undefined;
  const pressed = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: pressed.value }] }));
  return <AnimatedPressable accessibilityRole="button" {...rest} disabled={disabled}
    accessibilityState={{ ...accessibilityState, disabled: Boolean(disabled || accessibilityState?.disabled) }}
    onPressIn={(event: GestureResponderEvent) => {
      pressed.value = withTiming(Math.max(0.9, Math.min(1, scale)), { duration: 90, reduceMotion: ReduceMotion.System });
      onPressIn?.(event);
    }}
    onPressOut={(event: GestureResponderEvent) => {
      pressed.value = withSpring(1, { damping: 19, stiffness: 360, reduceMotion: ReduceMotion.System });
      onPressOut?.(event);
    }}
    style={[{ minHeight: 44, minWidth: 44, justifyContent: "center" }, primaryDefaults, style, disabled && { opacity: 0.45 }, animated]}>{children}</AnimatedPressable>;
}
