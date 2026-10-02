import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Vibration } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { cancelAnimation, runOnJS, withSpring, withTiming, type SharedValue, useSharedValue } from "react-native-reanimated";

/** 拖到这个位置松手就刷新。紧凑灵敏。 */
export const PULL_THRESHOLD = 68;
/** 刷新中，内容停在这个位置，下面露出指示器。 */
export const PULL_HOLD = 62;
/** 阻尼的上限：怎么拖都不会超过它。 */
const PULL_MAX = 120;
/** 刷新至少持续这么久，让指示器能转完一圈，不闪一下就没了。 */
const MIN_REFRESH_MS = 800;
/** 「已是最新」停留的时间。 */
const DONE_HOLD_MS = 480;

export type PullPhase = "idle" | "pulling" | "ready" | "refreshing" | "done" | "failed";

/** 手指拖动的距离越大越拉不动：开头跟手，越往后越紧。 */
function resist(distance: number): number {
  "worklet";
  return PULL_MAX * (1 - Math.exp(-distance / PULL_MAX));
}

type Options = {
  /** 列表当前的滚动位置。不在顶部时下拉只是普通滚动，不触发刷新。 */
  scrollY: SharedValue<number>;
  /** Return false when the caller has already handled a failed or skipped refresh. */
  onRefresh: () => void | boolean | Promise<void | boolean>;
};

/**
 * 原生列表等待下拉手势判断方向，避免 ScrollView 先拦截触摸。
 * 只有从顶部开始的向下拖动才接管；上滑、横滑和非顶部拖动立即放行。
 */
export function usePullToRefresh({ scrollY, onRefresh }: Options) {
  const pull = useSharedValue(0);
  const [phase, setPhaseState] = useState<PullPhase>("idle");
  const phaseRef = useRef<PullPhase>("idle");
  const phaseUI = useSharedValue<PullPhase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mounted = useRef(true);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  const notifyPhase = useCallback((next: PullPhase) => {
    if (!mounted.current) return;
    if (phaseRef.current === next) return;
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  const setPhase = useCallback((next: PullPhase) => { phaseUI.value = next; notifyPhase(next); }, [phaseUI, notifyPhase]);

  useEffect(
    () => { mounted.current = true; return () => {
      mounted.current = false;
      cancelAnimation(pull);
      for (const timer of timers.current) clearTimeout(timer);
      timers.current = [];
    }; },
    [pull],
  );

  const finish = useCallback(async () => {
    const started = Date.now();
    let succeeded = false;
    try {
      succeeded = await refresh.current() !== false;
    } catch {}
    if (!mounted.current) return;
    const wait = Math.max(0, MIN_REFRESH_MS - (Date.now() - started));
    timers.current.push(
      setTimeout(() => {
        setPhase(succeeded ? "done" : "failed");
        timers.current.push(
          setTimeout(() => {
            pull.value = withTiming(0, { duration: 280 });
            setPhase("idle");
            timers.current = [];
          }, DONE_HOLD_MS),
        );
      }, wait),
    );
  }, [pull, setPhase]);

  const beginRefresh = useCallback(() => { notifyPhase("refreshing"); void finish(); }, [finish, notifyPhase]);
  const readyFeedback = useCallback(() => Vibration.vibrate(12), []);
  const start = useSharedValue({ x: 0, y: 0 });
  const dragging = useSharedValue(false);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .cancelsTouchesInView(true)
        .onTouchesDown((event, manager) => {
          "worklet";
          dragging.value = false;
          const touch = event.allTouches[0];
          if (phaseUI.value === "refreshing" || phaseUI.value === "done" || phaseUI.value === "failed" || scrollY.value > 1 || event.numberOfTouches !== 1 || !touch) {
            manager.fail();
            return;
          }
          start.value = { x: touch.absoluteX, y: touch.absoluteY };
        })
        .onTouchesMove((event, manager) => {
          "worklet";
          if (dragging.value) return;
          const touch = event.allTouches[0];
          if (phaseUI.value === "refreshing" || phaseUI.value === "done" || phaseUI.value === "failed" || scrollY.value > 1 || event.numberOfTouches !== 1 || !touch) {
            manager.fail();
            return;
          }
          const dx = touch.absoluteX - start.value.x;
          const dy = touch.absoluteY - start.value.y;
          if (dy < -6 || (Math.abs(dx) > 6 && Math.abs(dx) * 1.2 >= dy)) {
            manager.fail();
          } else if (dy > 6 && dy > Math.abs(dx) * 1.2) {
            manager.activate();
          }
        })
        .onTouchesUp((_event, manager) => {
          "worklet";
          if (!dragging.value) manager.fail();
        })
        .onStart(() => {
          "worklet";
          dragging.value = true;
          cancelAnimation(pull);
        })
        .onUpdate((event) => {
          "worklet";
          if (phaseUI.value === "refreshing" || phaseUI.value === "done" || phaseUI.value === "failed") return;
          const next = resist(Math.max(0, event.translationY));
          pull.value = next;
          const nextPhase: PullPhase = next >= PULL_THRESHOLD ? "ready" : next > 0 ? "pulling" : "idle";
          if (nextPhase !== phaseUI.value) {
            phaseUI.value = nextPhase;
            if (nextPhase === "ready") runOnJS(readyFeedback)();
            runOnJS(notifyPhase)(nextPhase);
          }
        })
        .onEnd((_event, success) => {
          "worklet";
          if (!success || phaseUI.value === "refreshing" || phaseUI.value === "done" || phaseUI.value === "failed") return;
          if (phaseUI.value === "ready") {
            phaseUI.value = "refreshing";
            pull.value = withSpring(PULL_HOLD, { damping: 18, stiffness: 220 });
            runOnJS(beginRefresh)();
          } else {
            phaseUI.value = "idle";
            pull.value = withSpring(0, { damping: 20, stiffness: 240 });
            runOnJS(notifyPhase)("idle");
          }
        })
        .onFinalize((_event, success) => {
          "worklet";
          // 系统取消或切 Tab 时只回弹，不执行刷新。
          if (dragging.value && !success && phaseUI.value !== "refreshing" && phaseUI.value !== "done" && phaseUI.value !== "failed") {
            pull.value = withSpring(0, { damping: 20, stiffness: 240 });
            phaseUI.value = "idle";
            runOnJS(notifyPhase)("idle");
          }
          dragging.value = false;
        }),
    [pull, scrollY, phaseUI, start, dragging, notifyPhase, readyFeedback, beginRefresh],
  );
  const scrollGesture = useMemo(() => Gesture.Native().requireExternalGestureToFail(gesture).disallowInterruption(true), [gesture]);

  return {
    pull,
    phase,
    gesture,
    scrollGesture,
  };
}
