import type { ReactNode } from "react";
import { Dimensions, Platform, useWindowDimensions } from "react-native";
import Animated, { measure, runOnUI, useAnimatedRef, useAnimatedReaction, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Reserve only keyboard overlap not already removed by the native window. */
export function KeyboardViewport({ children, backgroundColor, reserveBottom = true }: { children: ReactNode; backgroundColor?: string; reserveBottom?: boolean }) {
  const { height, progress } = useReanimatedKeyboardAnimation();
  const { bottom } = useSafeAreaInsets();
  const window = useWindowDimensions();
  const screenHeight = Platform.OS === "android" ? Dimensions.get("screen").height : window.height;
  const ref = useAnimatedRef<Animated.View>();
  const edge = useSharedValue(0);
  const stableBottom = useSharedValue(bottom);
  const stableWidth = useSharedValue(window.width);
  useAnimatedReaction(() => ({ bottom, width: window.width, height: height.value, progress: progress.value }), state => {
    // Some Android inset dispatches report zero nav inset while the IME owns
    // the lower edge. Keep the closed-window inset throughout the animation.
    if (state.height === 0 && state.progress === 0 && (state.bottom > 0 || state.width !== stableWidth.value)) {
      stableBottom.value = state.bottom;
      stableWidth.value = state.width;
    }
  });
  const inset = useAnimatedStyle(() => {
    // Read the actual native frame during the IME animation too: Android may
    // resize the window before JS receives the corresponding layout event.
    const layout = _WORKLET ? measure(ref) : null;
    const lowerEdge = layout ? layout.pageY + layout.height : edge.value;
    const overlap = lowerEdge > 0 ? Math.max(0, lowerEdge - (screenHeight + height.value)) : 0;
    return { paddingBottom: Math.max(reserveBottom ? stableBottom.value * (1 - Math.max(0, Math.min(1, progress.value))) : 0, overlap) };
  });
  return <Animated.View ref={ref} onLayout={() => {
    runOnUI(() => {
      "worklet";
      const layout = measure(ref);
      if (layout) edge.value = layout.pageY + layout.height;
    })();
  }} style={[{ flex: 1, backgroundColor }, inset]}>{children}</Animated.View>;
}
