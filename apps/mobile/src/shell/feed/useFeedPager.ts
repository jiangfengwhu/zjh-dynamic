import { useEffect, useMemo, useRef, useState } from "react";
import PagerView, {
  type PagerViewOnPageScrollEvent,
} from "react-native-pager-view";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue, useEvent } from "react-native-reanimated";
import type { FeedSlot } from "../../../../../packages/ui/feed";
import { useProfileDrawer } from "../ProfileDrawer";
export type FeedCategory = FeedSlot | "user" | null;

/** Native pager owns page motion and defers right swipes to the shell drawer. */
export function useFeedPager({
  categories,
  selected,
  onSelect,
}: {
  categories: readonly FeedCategory[];
  selected: FeedCategory;
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
  const gesture = drawer.gesture;
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
