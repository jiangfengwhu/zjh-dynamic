import { Pressable, StyleSheet, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressyProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** 按下时缩到多少。大面积卡片用 0.985，按钮用 0.96。 */
  scale?: number;
};

/** 按下时跟手缩小，松手弹回。所有可点的东西都用它，反馈保持一致。 */
export function Pressy({ style, scale = 0.985, onPressIn, onPressOut, children, ...rest }: PressyProps) {
  const { colors, mode } = useTheme();
  // 仅主色填充按钮有软陶厚度，正文操作和列表保持平面。
  const clay = StyleSheet.flatten(style)?.backgroundColor === colors.accent;
  const pressed = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ translateY: clay ? (1 - pressed.value) * 45 : 0 }, { scale: pressed.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event: GestureResponderEvent) => {
        pressed.value = withTiming(clay ? 0.97 : Math.max(scale, 0.96), { duration: 100, reduceMotion: ReduceMotion.System });
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        pressed.value = withTiming(1, { duration: 200, reduceMotion: ReduceMotion.System });
        onPressOut?.(event);
      }}
      style={[{ minHeight: 48, minWidth: 48 }, style, clay && {
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 12,
        boxShadow: mode === "light"
          ? "0 4px 0 #C88371, 0 7px 12px rgba(107, 139, 155, 0.18), inset 0 2px 3px rgba(255, 255, 255, 0.6), inset 0 -2px 3px rgba(157, 73, 50, 0.12)"
          : "0 4px 0 #A76555, 0 7px 12px rgba(0, 0, 0, 0.18), inset 0 2px 3px rgba(255, 255, 255, 0.38)",
      }, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
