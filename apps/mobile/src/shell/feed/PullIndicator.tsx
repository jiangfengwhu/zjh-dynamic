import { useEffect } from "react";
import { Text } from "react-native";
import { ArrowDown, Check, RefreshCw, TriangleAlert } from "lucide-react-native";
import Animated, { Easing, Extrapolation, ReduceMotion, cancelAnimation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import { themedStyleSheet, useTheme } from "../../../../../packages/ui/theme";
import { PULL_THRESHOLD, type PullPhase } from "./pullToRefresh";

const LABEL: Record<PullPhase, string> = { idle: "下拉刷新", pulling: "下拉刷新", ready: "松开刷新", refreshing: "正在刷新", done: "已是最新", failed: "刷新未完成" };

/** Progress stays on the UI thread; reduced motion keeps a static status icon. */
export function PullIndicator({ pull, phase }: { pull: SharedValue<number>; phase: PullPhase }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const spin = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(spin);
    if (phase === "refreshing" && !reduceMotion) spin.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear, reduceMotion: ReduceMotion.System }), -1, false, undefined, ReduceMotion.System);
    else spin.value = 0;
    return () => cancelAnimation(spin);
  }, [phase, reduceMotion, spin]);
  const stage = useAnimatedStyle(() => ({ opacity: interpolate(pull.value, [6, 28], [0, 1], Extrapolation.CLAMP), transform: [{ translateY: Math.max(0, (pull.value - 32) / 2) }] }));
  const rotation = useAnimatedStyle(() => ({ transform: [{ rotate: `${reduceMotion ? 0 : phase === "refreshing" ? spin.value : interpolate(pull.value, [0, PULL_THRESHOLD], [0, 180], Extrapolation.CLAMP)}deg` }] }));
  const color = phase === "failed" ? colors.redText : colors.accentText;
  return <Animated.View pointerEvents="none" style={[styles.stage, stage]}>
    <Animated.View style={[styles.icon, phase === "done" || phase === "failed" ? undefined : rotation]}>
      {phase === "done" ? <Check size={18} color={color} /> : phase === "failed" ? <TriangleAlert size={18} color={color} /> : phase === "refreshing" ? <RefreshCw size={18} color={color} /> : <ArrowDown size={18} color={color} />}
    </Animated.View>
    <Text accessibilityLiveRegion="polite" style={[styles.label, { color }]}>{LABEL[phase]}</Text>
  </Animated.View>;
}
const styles = themedStyleSheet(t => ({
  stage: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  icon: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12, lineHeight: 18, fontWeight: "600" },
}));
