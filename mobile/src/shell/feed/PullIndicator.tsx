import { useEffect } from "react";
import { Text } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { themedStyleSheet, useTheme } from "../../../../components/theme";
import { PULL_THRESHOLD, type PullPhase } from "./pullToRefresh";

const PETALS = 5;
const FLOWER = 34;
const RADIUS = 9;

const LABEL: Record<PullPhase, string> = {
  idle: "下拉刷新",
  pulling: "下拉刷新",
  ready: "松开刷新",
  refreshing: "正在刷新",
  done: "已是最新",
};

/**
 * 下拉时从内容后面露出来的指示器：一朵五瓣的紫金花。
 * 往下拖，花瓣一片一片长出来，同时慢慢转开；拖过阈值花开满，刷新时整朵转起来。
 */
export function PullIndicator({ pull, phase }: { pull: SharedValue<number>; phase: PullPhase }) {
  const { colors } = useTheme();
  const spin = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(spin);
    if (phase === "refreshing") {
      spin.value = withRepeat(withTiming(360, { duration: 1200, easing: Easing.linear }), -1, false);
    } else {
      spin.value = withTiming(0, { duration: 220 });
    }
  }, [phase, spin]);

  const stage = useAnimatedStyle(() => ({
    opacity: interpolate(pull.value, [6, 28], [0, 1], Extrapolation.CLAMP),
    // 留出的空间是 pull 这么高，让花和字整体待在正中。
    transform: [{ translateY: Math.max(2, pull.value / 2 - (FLOWER + 16) / 2) }],
  }));
  const bloom = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(pull.value, [0, PULL_THRESHOLD], [0, 150], Extrapolation.CLAMP) + spin.value}deg` }],
  }));
  const core = useAnimatedStyle(() => {
    const progress = interpolate(pull.value, [0, PULL_THRESHOLD], [0.3, 1], Extrapolation.CLAMP);
    return { transform: [{ scale: progress }] };
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.stage, stage]}>
      <Animated.View style={[styles.flower, bloom]}>
        {Array.from({ length: PETALS }, (_, index) => (
          <Petal key={index} index={index} pull={pull} color={colors.accent} />
        ))}
        <Animated.View style={[styles.core, { backgroundColor: colors.orchid }, core]} />
      </Animated.View>
      <Text style={[styles.label, { color: phase === "ready" || phase === "refreshing" ? colors.accentText : colors.ink3 }]}>
        {LABEL[phase]}
      </Text>
    </Animated.View>
  );
}

function Petal({ index, pull, color }: { index: number; pull: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    // 第 index 片比前一片晚一点长出来。
    const start = (index / PETALS) * 0.55 * PULL_THRESHOLD;
    const grown = interpolate(pull.value, [start, start + PULL_THRESHOLD * 0.4], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: grown,
      transform: [{ rotate: `${(360 / PETALS) * index}deg` }, { translateY: -RADIUS }, { scale: 0.25 + 0.75 * grown }],
    };
  });
  return <Animated.View style={[styles.petal, { backgroundColor: color }, style]} />;
}

const styles = themedStyleSheet(() => ({
  stage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 4,
  },
  flower: {
    width: FLOWER,
    height: FLOWER,
    alignItems: "center",
    justifyContent: "center",
  },
  petal: {
    position: "absolute",
    width: 9,
    height: 16,
    borderRadius: 5,
  },
  core: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
}));