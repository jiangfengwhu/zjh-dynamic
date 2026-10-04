import { useMemo, type ReactElement } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { PullIndicator } from "./PullIndicator";
import type { usePullToRefresh } from "./pullToRefresh";

/** Shared timeline refresh presentation and gesture arbitration. */
export function PullRefreshSurface({ refresh, drawerGesture, top = 0, children }: {
  refresh: ReturnType<typeof usePullToRefresh>;
  drawerGesture?: ReturnType<typeof Gesture.Pan>;
  top?: number;
  children: ReactElement;
}) {
  const native = useMemo(() => drawerGesture
    ? Gesture.Native().requireExternalGestureToFail(refresh.gesture, drawerGesture).disallowInterruption(true)
    : refresh.scrollGesture, [drawerGesture, refresh.gesture, refresh.scrollGesture]);
  const { pull } = refresh;
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: pull.value }] }));
  return <GestureDetector gesture={refresh.gesture}>
    <View style={{ flex: 1, overflow: "hidden" }}>
      <View pointerEvents="none" style={{ position: "absolute", top, left: 0, right: 0 }}><PullIndicator pull={refresh.pull} phase={refresh.phase} /></View>
      <Animated.View style={[{ flex: 1 }, lift]}><GestureDetector gesture={native}>{children}</GestureDetector></Animated.View>
    </View>
  </GestureDetector>;
}
