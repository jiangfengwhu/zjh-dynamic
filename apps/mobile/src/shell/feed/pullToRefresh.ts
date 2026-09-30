import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Vibration } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import { cancelAnimation, withSpring, withTiming, type SharedValue, useSharedValue } from "react-native-reanimated";

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

export type PullPhase = "idle" | "pulling" | "ready" | "refreshing" | "done";

/** 手指拖动的距离越大越拉不动：开头跟手，越往后越紧。 */
function resist(distance: number): number {
  return PULL_MAX * (1 - Math.exp(-distance / PULL_MAX));
}

type Options = {
  /** 列表当前的滚动位置。不在顶部时下拉只是普通滚动，不触发刷新。 */
  scrollY: SharedValue<number>;
  onRefresh: () => void | Promise<void>;
};

/**
 * 原生列表等待下拉手势判断方向，避免 ScrollView 先拦截触摸。
 * 只有从顶部开始的向下拖动才接管；上滑、横滑和非顶部拖动立即放行。
 */
export function usePullToRefresh({ scrollY, onRefresh }: Options) {
  const pull = useSharedValue(0);
  const [phase, setPhaseState] = useState<PullPhase>("idle");
  const phaseRef = useRef<PullPhase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  const setPhase = useCallback((next: PullPhase) => {
    if (phaseRef.current === next) return;
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  useEffect(
    () => () => {
      cancelAnimation(pull);
      for (const timer of timers.current) clearTimeout(timer);
    },
    [pull],
  );

  const busy = () => phaseRef.current === "refreshing" || phaseRef.current === "done";

  const finish = useCallback(async () => {
    const started = Date.now();
    try {
      await refresh.current();
    } catch (error) {
      console.log("feed refresh failed", error instanceof Error ? error.message : String(error));
    }
    const wait = Math.max(0, MIN_REFRESH_MS - (Date.now() - started));
    timers.current.push(
      setTimeout(() => {
        setPhase("done");
        timers.current.push(
          setTimeout(() => {
            pull.value = withTiming(0, { duration: 280 });
            setPhase("idle");
          }, DONE_HOLD_MS),
        );
      }, wait),
    );
  }, [pull, setPhase]);

  const release = useCallback(() => {
    if (busy()) return;
    if (phaseRef.current === "ready") {
      console.log("feed pull refresh");
      setPhase("refreshing");
      pull.value = withSpring(PULL_HOLD, { damping: 18, stiffness: 220 });
      void finish();
      return;
    }
    pull.value = withSpring(0, { damping: 20, stiffness: 240 });
    setPhase("idle");
  }, [finish, pull, setPhase]);

  const start = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .runOnJS(true)
        .onTouchesDown((event, manager) => {
          dragging.current = false;
          const touch = event.allTouches[0];
          if (busy() || scrollY.value > 1 || event.numberOfTouches !== 1 || !touch) {
            manager.fail();
            return;
          }
          start.current = { x: touch.absoluteX, y: touch.absoluteY };
        })
        .onTouchesMove((event, manager) => {
          if (dragging.current) return;
          const touch = event.allTouches[0];
          if (busy() || scrollY.value > 1 || event.numberOfTouches !== 1 || !touch) {
            manager.fail();
            return;
          }
          const dx = touch.absoluteX - start.current.x;
          const dy = touch.absoluteY - start.current.y;
          if (dy < -6 || (Math.abs(dx) > 6 && Math.abs(dx) * 1.2 >= dy)) {
            manager.fail();
          } else if (dy > 6 && dy > Math.abs(dx) * 1.2) {
            manager.activate();
          }
        })
        .onStart(() => {
          dragging.current = true;
          cancelAnimation(pull);
        })
        .onUpdate((event) => {
          if (busy()) return;
          const next = resist(Math.max(0, event.translationY));
          pull.value = next;
          if (next >= PULL_THRESHOLD) {
            if (phaseRef.current !== "ready") Vibration.vibrate(12);
            setPhase("ready");
          } else {
            setPhase(next > 0 ? "pulling" : "idle");
          }
        })
        .onEnd((_event, success) => {
          if (success) release();
        })
        .onFinalize((_event, success) => {
          // 系统取消或切 Tab 时只回弹，不执行刷新。
          if (dragging.current && !success && !busy()) {
            pull.value = withSpring(0, { damping: 20, stiffness: 240 });
            setPhase("idle");
          }
          dragging.current = false;
        }),
    [pull, release, scrollY, setPhase],
  );
  const scrollGesture = useMemo(() => Gesture.Native().requireExternalGestureToFail(gesture), [gesture]);

  return {
    pull,
    phase,
    gesture,
    scrollGesture,
  };
}
