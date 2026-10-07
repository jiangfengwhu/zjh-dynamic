import { createContext, useContext, type ReactNode } from "react";
import { Dimensions, Platform, useWindowDimensions } from "react-native";
import Animated, { measure, useAnimatedRef, useAnimatedReaction, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const KeyboardViewportContext = createContext(false);

/** Reserve only keyboard overlap not already removed by the native window. */
export function KeyboardViewport({ children, backgroundColor, reserveBottom = true, independent = false }: { children: ReactNode; backgroundColor?: string; reserveBottom?: boolean; independent?: boolean }) {
  const parentAvoidsKeyboard = useContext(KeyboardViewportContext) && !independent;
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
    const needsOverlap = !parentAvoidsKeyboard && Math.abs(height.value) > 0;
    const layout = _WORKLET && needsOverlap && edge.value > 0 ? measure(ref) : null;
    const lowerEdge = layout ? layout.pageY + layout.height : edge.value;
    const overlap = needsOverlap && lowerEdge > 0 ? Math.max(0, lowerEdge - (screenHeight - Math.abs(height.value))) : 0;
    return { paddingBottom: Math.max(reserveBottom ? stableBottom.value * (1 - Math.max(0, Math.min(1, progress.value))) : 0, overlap) };
  });
  return <Animated.View ref={ref} collapsable={false} onLayout={event => {
    edge.value = event.nativeEvent.layout.y + event.nativeEvent.layout.height;
  }} style={[{ flex: 1, backgroundColor }, inset]}><KeyboardViewportContext.Provider value={true}>{children}</KeyboardViewportContext.Provider></Animated.View>;
}
