import type { ReactNode } from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Full-screen keyboard inset, without measuring a changing nested layout. */
export function KeyboardViewport({ children }: { children: ReactNode }) {
  const { height } = useReanimatedKeyboardAnimation();
  const { bottom } = useSafeAreaInsets();
  const inset = useAnimatedStyle(() => ({ paddingBottom: Math.max(bottom, -height.value) }));
  return <Animated.View style={[{ flex: 1 }, inset]}>{children}</Animated.View>;
}
