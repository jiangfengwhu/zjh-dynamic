import { createContext, useContext } from "react";
import type { FlatList } from "react-native";
import {
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";

export const PROFILE_RANGE = 108;
export const PROFILE_INSET = PROFILE_RANGE + 52;
export const ProfileScrollContext = createContext<{
  active: SharedValue<string>;
  collapsed: SharedValue<number>;
  viewport: number;
} | null>(null);

/** Only the shared identity range is synchronized; body offsets stay independent. */
export function useProfileScroll<T>(
  key: string,
  externalY?: SharedValue<number>,
) {
  const context = useContext(ProfileScrollContext);
  const fallbackActive = useSharedValue(key);
  const fallbackCollapsed = useSharedValue(0);
  const active = context?.active ?? fallbackActive;
  const collapsed = context?.collapsed ?? fallbackCollapsed;
  const enabled = !!context;
  const ref = useAnimatedRef<FlatList<T>>();
  const offset = useSharedValue(0);
  const ready = useSharedValue(false);
  const measurement = useSharedValue(0);
  const moving = useSharedValue(false);
  const onScroll = useAnimatedScrollHandler(
    {
      onBeginDrag: () => {
        moving.value = true;
      },
      onScroll: (event) => {
        if (enabled && active.value !== key) return;
        const next = Math.max(0, event.contentOffset.y);
        offset.value = next;
        if (externalY) externalY.value = next;
        if (enabled && active.value === key)
          collapsed.value = Math.min(PROFILE_RANGE, next);
      },
      onEndDrag: (event) => {
        if (enabled && active.value === key) collapsed.value = Math.min(PROFILE_RANGE, Math.max(0, event.contentOffset.y));
        moving.value = false;
      },
      onMomentumBegin: () => {
        moving.value = true;
      },
      onMomentumEnd: (event) => {
        if (enabled && active.value === key) collapsed.value = Math.min(PROFILE_RANGE, Math.max(0, event.contentOffset.y));
        moving.value = false;
      },
    },
    [enabled, key],
  );
  useAnimatedReaction(
    () => ({
      active: active.value === key,
      collapse: collapsed.value,
      ready: ready.value,
      measurement: measurement.value,
    }),
    (state, previous) => {
      if (!enabled || !state.ready || moving.value) return;
      if (offset.value > PROFILE_RANGE) {
        if (state.active && !previous?.active) collapsed.value = PROFILE_RANGE;
        return;
      }
      // The active list owns its native offset, including momentum/layout events.
      // Never rewind it to a stale header position after a fast gesture.
      if (state.active && previous?.active) return;
      if (
        Math.abs(offset.value - state.collapse) > 0.5 ||
        (state.active &&
          (!previous?.active ||
            !previous.ready ||
            state.measurement !== previous.measurement))
      ) {
        offset.value = state.collapse;
        scrollTo(ref, 0, state.collapse, false);
        if (externalY) externalY.value = state.collapse;
      }
    },
    [enabled, key],
  );
  return {
    ref,
    onScroll,
    onLayout: (event: import("react-native").LayoutChangeEvent) => {
      ready.value = event.nativeEvent.layout.height > 0;
      measurement.value++;
    },
    onContentSizeChange: () => {
      measurement.value++;
    },
    contentStyle: context
      ? {
          paddingTop: PROFILE_INSET + 8,
          minHeight: context.viewport + PROFILE_RANGE,
        }
      : undefined,
    refreshOffset: context ? PROFILE_INSET : 0,
  };
}
