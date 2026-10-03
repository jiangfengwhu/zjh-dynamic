import { Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type PressyProps = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  /** 按下时缩到多少。大面积卡片用 0.985，按钮用 0.96。 */
  scale?: number;
};

/** 按下时跟手缩小，松手弹回。所有可点的东西都用它，反馈保持一致。 */
export function Pressy({ style, scale = 0.985, onPressIn, onPressOut, children, ...rest }: PressyProps) {
  const pressed = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: pressed.value }] }));
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event: GestureResponderEvent) => {
        pressed.value = withTiming(Math.max(scale, 0.96), { duration: 100, reduceMotion: ReduceMotion.System });
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        pressed.value = withTiming(1, { duration: 160, reduceMotion: ReduceMotion.System });
        onPressOut?.(event);
      }}
      style={[{ minHeight: 48, minWidth: 48 }, style, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}
