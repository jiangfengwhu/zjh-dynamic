import { useEffect, useMemo, useRef, useState } from "react";
import PagerView, {
  type PagerViewOnPageScrollEvent,
} from "react-native-pager-view";
import { Gesture } from "react-native-gesture-handler";
import {
  cancelAnimation,
  runOnJS,
  useSharedValue,
  useEvent,
} from "react-native-reanimated";
import type { FeedSlot } from "../../../../../packages/ui/feed";
import { useProfileDrawer } from "../ProfileDrawer";
export type FeedCategory = FeedSlot | "user" | null;

/** Native pager owns page motion; only the All boundary owns drawer opening. */
export function useFeedPager({
  categories,
  selected,
  blocked,
  onSelect,
}: {
  categories: readonly FeedCategory[];
  selected: FeedCategory;
  blocked: boolean;
  onSelect: (category: FeedCategory) => void;
}) {
  const drawer = useProfileDrawer();
  const ref = useRef<PagerView>(null);
  const current = useRef(0);
  const index = Math.max(0, categories.indexOf(selected));
  const pagePosition = useSharedValue(0);
  const onPageScroll = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      "worklet";
      pagePosition.value = event.position + event.offset;
    },
    ["onPageScroll"]
  );
  const [mounted, setMounted] = useState(() => new Set(categories.slice(0, 2)));
  useEffect(() => {
    if (current.current === index) return;
    const distance = Math.abs(current.current - index);
    current.current = index;
    if (distance > 1) {
      pagePosition.value = index;
      ref.current?.setPageWithoutAnimation(index);
    } else ref.current?.setPage(index);
  }, [index, pagePosition]);
  useEffect(() => {
    const task = requestIdleCallback(() =>
      setMounted((previous) => {
        const next = new Set(previous);
        for (const category of categories.slice(
          Math.max(0, index - 1),
          index + 2
        ))
          next.add(category);
        return next.size === previous.size ? previous : next;
      })
    );
    return () => cancelIdleCallback(task);
  }, [categories, index]);
  const origin = useSharedValue({ x: 0, y: 0 });
  const active = useSharedValue(false);
  const progress = drawer.progress;
  const width = drawer.width;
  const startDrag = drawer.startDrag;
  const settle = drawer.settle;
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(selected === null && !blocked)
        .manualActivation(true)
        .maxPointers(1)
        .onTouchesDown((event, manager) => {
          active.value = false;
          const t = event.allTouches[0];
          if (!t || event.numberOfTouches !== 1) {
            manager.fail();
            return;
          }
          origin.value = { x: t.absoluteX, y: t.absoluteY };
        })
        .onTouchesMove((event, manager) => {
          if (active.value) return;
          const t = event.allTouches[0];
          if (!t || event.numberOfTouches !== 1) {
            manager.fail();
            return;
          }
          const dx = t.absoluteX - origin.value.x;
          const dy = Math.abs(t.absoluteY - origin.value.y);
          if (dx < -4 || (dy > 4 && dy >= Math.abs(dx))) manager.fail();
          else if (dx > 6 && dx > dy * 1.3) manager.activate();
        })
        .onTouchesUp((_event, manager) => {
          if (!active.value) manager.fail();
        })
        .onStart(() => {
          active.value = true;
          cancelAnimation(progress);
          runOnJS(startDrag)();
        })
        .onUpdate((event) => {
          progress.value = Math.max(0, Math.min(1, event.translationX / width));
        })
        .onEnd((event) => {
          runOnJS(settle)(
            event.velocityX > 500 ||
              (event.velocityX >= -500 && progress.value > 0.4)
          );
        })
        .onFinalize((_event, success) => {
          if (active.value && !success) runOnJS(settle)(false);
          active.value = false;
        }),
    [selected, blocked, origin, active, progress, width, startDrag, settle]
  );
  const nativeGesture = useMemo(
    () => Gesture.Native().requireExternalGestureToFail(gesture),
    [gesture]
  );
  const onPageSelected = (event: { nativeEvent: { position: number } }) => {
    const next = event.nativeEvent.position;
    current.current = next;
    if (categories[next] !== undefined) onSelect(categories[next]);
  };
  return {
    ref,
    gesture,
    nativeGesture,
    onPageSelected,
    onPageScroll,
    pagePosition,
    mounted,
    index,
  };
}
