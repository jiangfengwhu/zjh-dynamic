import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PagerView, {
  type PagerViewOnPageScrollEvent,
} from "react-native-pager-view";
import { useFocusEffect } from "@react-navigation/native";
import { Gesture } from "react-native-gesture-handler";
import { useSharedValue, useEvent } from "react-native-reanimated";
import type { FeedSlot } from "../../../../../packages/ui/feed";
import { useProfileDrawer } from "../ProfileDrawer";
export type FeedCategory = FeedSlot | "user" | null;

/** Native paging owns both directions; only All defers right swipes to the drawer. */
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
  const boundary = drawer.feedBoundary;
  useFocusEffect(
    useCallback(() => {
      boundary.value = selected === null;
      return () => {
        boundary.value = true;
      };
    }, [boundary, selected])
  );
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
  const idleTask = useRef<ReturnType<typeof requestIdleCallback> | null>(null);
  const moving = useRef(false);
  const warm = useCallback(() => {
    if (idleTask.current !== null) cancelIdleCallback(idleTask.current);
    idleTask.current = null;
    if (moving.current) return;
    idleTask.current = requestIdleCallback(() => {
      idleTask.current = null;
      if (moving.current) return;
      setMounted((previous) => {
        const next = new Set(previous);
        for (const category of categories.slice(
          Math.max(0, current.current - 1),
          current.current + 2
        ))
          next.add(category);
        return next.size === previous.size ? previous : next;
      });
    });
  }, [categories]);
  useEffect(() => {
    warm();
    return () => {
      if (idleTask.current !== null) cancelIdleCallback(idleTask.current);
    };
  }, [warm, index]);
  const onPageScrollStateChanged = useCallback(
    (event: { nativeEvent: { pageScrollState: string } }) => {
      moving.current = event.nativeEvent.pageScrollState !== "idle";
      warm();
    },
    [warm]
  );
  const gesture = drawer.gesture;
  const nativeGesture = useMemo(
    () => Gesture.Native().requireExternalGestureToFail(gesture),
    [gesture]
  );
  const onPageSelected = (event: { nativeEvent: { position: number } }) => {
    const next = event.nativeEvent.position;
    current.current = next;
    boundary.value = next === 0;
    if (categories[next] !== undefined) onSelect(categories[next]);
  };
  return {
    ref,
    gesture,
    nativeGesture,
    onPageSelected,
    onPageScroll,
    onPageScrollStateChanged,
    pagePosition,
    mounted,
    index,
  };
}
