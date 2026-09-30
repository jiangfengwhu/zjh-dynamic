import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Icon } from "@zijinhua/app-sdk/ui";
import { getAppContext } from "@zijinhua/app-sdk";
import { themedStyleSheet, useTheme } from "@zijinhua/app-sdk/ui";

/** Jolly 的卡片和主页共用的零件。这里不登记任何东西，谁引用谁才生效。 */

/** 一次制作在动态帖子里带的现场。 */
export type JollyWork = {
  phase: string;
  wish: string;
  status: string;
  steps: string[];
};

export function readWork(payload: Record<string, unknown>, fallbackPhase: string): JollyWork {
  const steps = Array.isArray(payload.steps) ? payload.steps.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
  return {
    phase: typeof payload.phase === "string" && payload.phase ? payload.phase : fallbackPhase,
    wish: typeof payload.wish === "string" ? payload.wish.trim() : "",
    status: typeof payload.status === "string" ? payload.status.trim() : "",
    steps,
  };
}

const STATIONS = ["心愿", "制作", "完成"] as const;

/** 做到了哪一站。-1 表示还没开始。 */
export function stationIndex(phase: string, status: string): number {
  if (phase === "ready") return 2;
  if (phase === "idle") return -1;
  if (phase === "making") return 1;
  if (status.includes("检查") || status.includes("打包") || status.includes("实现") || status.includes("加载")) return 1;
  return phase === "failed" || phase === "stopped" ? 0 : -1;
}

/** 朋友请壳替它跳转：换到某个标签页、打开另一位朋友，或者返回。见 navigation.tsx 里的 SHELL_NAV_REQUEST。 */
export function askShell(request: { action: "tab"; tab: "feed" | "agent" | "mine" } | { action: "open"; id: string } | { action: "back" }) {
  if (request.action === "back") getAppContext().navigation.back();
  else if (request.action === "tab" && request.tab === "agent") getAppContext().navigation.create();
  else getAppContext().navigation.open();
}

/** 「多久以前」。 */
export function ago(ms: number): string {
  const delta = Date.now() - ms;
  if (delta < 60_000) return "刚刚";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)} 分钟前`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)} 小时前`;
  return `${Math.floor(delta / 86_400_000)} 天前`;
}

/** 一颗缓慢呼吸的点，表示「正在进行」。 */
export function Pulse({ color, size = 8, live = true }: { color: string; size?: number; live?: boolean }) {
  const glow = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(glow);
    if (!live) {
      glow.value = 1;
      return;
    }
    const ease = Easing.inOut(Easing.quad);
    glow.value = withRepeat(withSequence(withTiming(0.25, { duration: 800, easing: ease }), withTiming(1, { duration: 800, easing: ease })), -1, false);
  }, [glow, live]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/**
 * 心愿 → 制作 → 完成。金线走到做到的那一站，下面跟着最近几步的记录：
 * 做完的打勾，正在做的那一步带一颗呼吸的点。
 */
export function WorkProgress({ work }: { work: JollyWork }) {
  const { colors } = useTheme();
  const active = stationIndex(work.phase, work.status);
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(Math.max(0, active) / (STATIONS.length - 1), { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [active, progress]);
  const fill = useAnimatedStyle(() => ({ width: Math.max(0, width - NODE) * progress.value }));
  const running = work.phase === "making";
  const steps = work.steps.slice(-3);

  return (
    <View style={styles.progress}>
      <View style={styles.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <View style={[styles.line, styles.base, { backgroundColor: colors.line }]} />
        <Animated.View style={[styles.line, { backgroundColor: colors.accent }, fill]} />
        {STATIONS.map((label, index) => {
          const done = active > index;
          const current = active === index;
          return (
            <View key={label} style={styles.station}>
              <View
                style={[
                  styles.node,
                  {
                    backgroundColor: done ? colors.accent : colors.surfaceRaised,
                    borderColor: done || current ? colors.accent : colors.lineStrong,
                  },
                ]}
              >
                {done ? <Icon name="check" size={10} color={colors.onAccent} strokeWidth={2.4} /> : null}
                {current ? <Pulse color={colors.accent} size={6} live={running} /> : null}
              </View>
              <Text style={[styles.label, { color: done || current ? colors.ink1 : colors.ink3, fontWeight: current ? "700" : "500" }]}>{label}</Text>
            </View>
          );
        })}
      </View>

      {steps.length > 0 ? (
        <View style={styles.steps}>
          {steps.map((step, index) => {
            const last = index === steps.length - 1;
            const going = last && running;
            return (
              <View key={`${step}-${index}`} style={styles.step}>
                <View style={styles.mark}>
                  {going ? <Pulse color={colors.accent} size={5} /> : <Icon name="check" size={11} color={colors.accentText} strokeWidth={2.2} />}
                </View>
                <Text style={[styles.stepText, { color: going ? colors.ink1 : colors.ink2 }]} numberOfLines={2}>
                  {step}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const NODE = 18;

const styles = themedStyleSheet((t) => ({
  progress: {
    gap: 8,
  },
  track: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  line: {
    position: "absolute",
    top: NODE / 2 - 1,
    left: NODE / 2,
    height: 1.5,
    borderRadius: 1,
  },
  base: {
    right: NODE / 2,
  },
  station: {
    alignItems: "center",
    gap: 3,
    minWidth: 36,
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 1.2,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  steps: {
    gap: 4,
    marginTop: 2,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mark: {
    width: 14,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
}));
