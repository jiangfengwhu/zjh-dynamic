import { useCallback, useEffect, useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import type { FeedSlot } from "../../../../../packages/ui/feed";

export type FeedCategory = FeedSlot | "user" | null;
const spring = {
  damping: 28,
  stiffness: 320,
  reduceMotion: ReduceMotion.Never,
};

/** One horizontal owner; vertical intent fails immediately back to the native list. */
export function useFeedPager({
  categories,
  selected,
  width,
  blocked,
  onSelect,
  onDrawer,
}: {
  categories: readonly FeedCategory[];
  selected: FeedCategory;
  width: number;
  blocked: boolean;
  onSelect: (category: FeedCategory) => void;
  onDrawer: () => void;
}) {
  const index = Math.max(0, categories.indexOf(selected));
  const position = useSharedValue(-index * width);
  const origin = useSharedValue({ x: 0, y: 0 });
  const start = useSharedValue(0);
  const active = useSharedValue(false);
  const select = useCallback(
    (next: number) => onSelect(categories[next]),
    [categories, onSelect]
  );
  useEffect(() => {
    cancelAnimation(position);
    position.value =
      Math.abs(position.value + index * width) > width * 1.1
        ? -index * width
        : withSpring(-index * width, spring);
  }, [index, width, position]);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!blocked)
        .manualActivation(true)
        .maxPointers(1)
        .onTouchesDown((event, manager) => {
          const touch = event.allTouches[0];
          active.value = false;
          if (!touch || event.numberOfTouches !== 1) {
            manager.fail();
            return;
          }
          origin.value = { x: touch.absoluteX, y: touch.absoluteY };
        })
        .onTouchesMove((event, manager) => {
          if (active.value) return;
          const touch = event.allTouches[0];
          if (!touch || event.numberOfTouches !== 1) {
            manager.fail();
            return;
          }
          const dx = Math.abs(touch.absoluteX - origin.value.x);
          const dy = Math.abs(touch.absoluteY - origin.value.y);
          if (dy > 4 && dy >= dx) manager.fail();
          else if (dx > 6 && dx > dy * 1.3) manager.activate();
        })
        .onTouchesUp((_event, manager) => {
          if (!active.value) manager.fail();
        })
        .onStart(() => {
          active.value = true;
          cancelAnimation(position);
          start.value = position.value;
        })
        .onUpdate((event) => {
          const next =
            start.value + Math.max(-width, Math.min(width, event.translationX));
          const min = -(categories.length - 1) * width;
          position.value =
            next > 0
              ? next * 0.18
              : next < min
              ? min + (next - min) * 0.18
              : next;
        })
        .onEnd((event) => {
          const significant =
            Math.abs(event.translationX) > width * 0.22 ||
            Math.abs(event.velocityX) > 500;
          if (selected === null && event.translationX < 0 && significant) {
            position.value = withSpring(-index * width, spring);
            runOnJS(onDrawer)();
            return;
          }
          const direction = event.translationX > 0 ? -1 : 1;
          const next = significant
            ? Math.max(0, Math.min(categories.length - 1, index + direction))
            : index;
          position.value = withSpring(-next * width, spring);
          if (next !== index) runOnJS(select)(next);
        })
        .onFinalize((_event, success) => {
          if (active.value && !success)
            position.value = withSpring(-index * width, spring);
          active.value = false;
        }),
    [
      blocked,
      categories.length,
      index,
      selected,
      width,
      onDrawer,
      select,
      position,
      origin,
      start,
      active,
    ]
  );
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value }],
  }));
  return { gesture, motion, index };
}
