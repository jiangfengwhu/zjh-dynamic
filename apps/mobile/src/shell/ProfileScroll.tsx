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
/** 动态/作品切换条的高度；条内分段控件垂直居中。 */
export const PROFILE_TABS = 44;
export const PROFILE_INSET = PROFILE_RANGE + PROFILE_TABS;
export const ProfileScrollContext = createContext<{
  active: SharedValue<string>;
  collapsed: SharedValue<number>;
  paging: SharedValue<boolean>;
  viewport: number;
} | null>(null);

/** Only the shared identity range is synchronized; body offsets stay independent. */
export function useProfileScroll<T>(
  key: string,
  externalY?: SharedValue<number>
) {
  const context = useContext(ProfileScrollContext);
  const fallbackActive = useSharedValue(key);
  const fallbackCollapsed = useSharedValue(0);
  const fallbackPaging = useSharedValue(false);
  const active = context?.active ?? fallbackActive;
  const collapsed = context?.collapsed ?? fallbackCollapsed;
  const paging = context?.paging ?? fallbackPaging;
  const enabled = !!context;
  const ref = useAnimatedRef<FlatList<T>>();
  const offset = useSharedValue(0);
  const body = useSharedValue(0);
  const syncing = useSharedValue(-1);
  const ready = useSharedValue(false);
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  // Ownership lasts for the whole vertical scroll session, including the gap
  // between drag end and momentum begin and any final native scroll events.
  // Only horizontal paging transfers it; lifecycle callbacks are not a lock.
  const userScroll = useSharedValue(false);
  const updateMovement = (raw: number) => {
    "worklet";
    if (enabled && userScroll.value && active.value === key && !paging.value) {
      const next = Math.max(0, raw);
      // Returning upward consumes body scroll first; identity expands only
      // after reaching the header range, including a gesture crossing its edge.
      collapsed.value = Math.min(
        PROFILE_RANGE,
        next,
        collapsed.value + Math.max(0, next - offset.value)
      );
      offset.value = next;
      body.value = Math.max(0, next - collapsed.value);
      if (externalY) externalY.value = next;
    }
  };
  const onScroll = useAnimatedScrollHandler(
    {
      onBeginDrag: (event) => {
        if (enabled && active.value !== key) return;
        // A native vertical drag has won gesture arbitration. Do not discard
        // its first event because the pager's idle notification arrived late.
        if (enabled) paging.value = false;
        syncing.value = -1;
        userScroll.value = true;
        updateMovement(event.contentOffset.y);
      },
      onScroll: (event) => {
        const next = Math.max(0, event.contentOffset.y);
        // Ignore queued native events from before a programmatic alignment.
        if (syncing.value >= 0) {
          if (Math.abs(next - syncing.value) > 1) return;
          syncing.value = -1;
        }
        const delta = next - offset.value;
        offset.value = next;
        if (!enabled) {
          if (externalY) externalY.value = next;
          return;
        }
        if (active.value !== key || paging.value) return;
        if (externalY) externalY.value = next;
        if (!userScroll.value) return;
        // Only vertical user movement changes identity size. Pager selection,
        // measurement and scrollTo acknowledgements never change it.
        collapsed.value = Math.min(
          PROFILE_RANGE,
          next,
          collapsed.value + Math.max(0, delta)
        );
        body.value = Math.max(0, next - collapsed.value);
      },
      onEndDrag: (event) => {
        updateMovement(event.contentOffset.y);
      },
      onMomentumEnd: (event) => {
        updateMovement(event.contentOffset.y);
      },
    },
    [enabled, key]
  );
  useAnimatedReaction(
    () => ({
      active: active.value === key,
      collapse: collapsed.value,
      paging: paging.value,
      ready: ready.value,
      height: contentHeight.value,
      viewport: viewportHeight.value,
    }),
    (state, previous) => {
      if (!enabled || !state.ready) return;
      if (state.paging || !state.active) userScroll.value = false;
      if (state.active && userScroll.value) return;
      const maximum = Math.max(0, state.height - state.viewport);
      // Preserve each page's body offset, plus ONE shared header contribution.
      // Rebase deep and shallow lists before horizontal paging reveals them.
      const target = Math.min(maximum, body.value + state.collapse);
      body.value = Math.max(0, target - state.collapse);
      if (
        Math.abs(offset.value - target) > 0.5 ||
        (state.paging && !previous?.paging)
      ) {
        syncing.value = target;
        offset.value = target;
        scrollTo(ref, 0, target, false);
      }
      if (state.active && externalY) externalY.value = target;
    },
    [enabled, key]
  );
  return {
    ref,
    onScroll,
    onLayout: (event: import("react-native").LayoutChangeEvent) => {
      viewportHeight.value = event.nativeEvent.layout.height;
      ready.value = viewportHeight.value > 0 && contentHeight.value > 0;
    },
    onContentSizeChange: (_width: number, height: number) => {
      contentHeight.value = height;
      ready.value = viewportHeight.value > 0 && height > 0;
    },
    contentStyle: context
      ? {
          paddingTop: PROFILE_INSET,
          minHeight: context.viewport + PROFILE_RANGE,
        }
      : undefined,
    emptyContentStyle: {
      flexGrow: 1,
      ...(context ? { minHeight: context.viewport } : {}),
    },
    refreshOffset: context ? PROFILE_INSET : 0,
  };
}
