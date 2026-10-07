import type { ReactNode } from "react";
import { View, useWindowDimensions } from "react-native";
import { SafeAreaProvider, useSafeAreaFrame, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useTheme } from "../../ui/theme";
import type { AppDefinition } from "./index";

/** The host owns the default opaque navigation area; application content starts above it. */
export function ApplicationViewport({ children, navigationBar }: { children: ReactNode; navigationBar?: AppDefinition["navigationBar"] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const frame = useSafeAreaFrame();
  const { width } = useWindowDimensions();
  const { height, progress } = useReanimatedKeyboardAnimation();
  const bottom = useSharedValue(insets.bottom);
  const stableWidth = useSharedValue(width);
  const transparent = navigationBar?.transparent === true;
  const backgroundColor = navigationBar?.backgroundColor ?? colors.canvas;
  useAnimatedReaction(() => ({ inset: insets.bottom, width, height: height.value, progress: progress.value }), next => {
    if (next.height === 0 && next.progress === 0 && (next.inset > 0 || next.width !== stableWidth.value)) {
      bottom.value = next.inset;
      stableWidth.value = next.width;
    }
  });
  const barStyle = useAnimatedStyle(() => ({ height: bottom.value * (1 - Math.max(0, Math.min(1, progress.value))) }));
  return <View style={{ flex: 1, backgroundColor }}>
    <SafeAreaProvider style={{ flex: 1 }} initialMetrics={{
      frame: { ...frame, height: Math.max(0, frame.height - (transparent ? 0 : insets.bottom)) },
      insets: { ...insets, bottom: transparent ? insets.bottom : 0 },
    }}>
      {children}
    </SafeAreaProvider>
    {transparent ? null : <Animated.View pointerEvents="none" accessible={false} style={[{ backgroundColor }, barStyle]} />}
  </View>;
}
