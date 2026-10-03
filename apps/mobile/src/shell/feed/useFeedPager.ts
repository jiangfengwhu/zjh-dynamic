import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
  type PageScrollStateChangedNativeEvent,
} from "react-native-pager-view";
import { useFocusEffect } from "@react-navigation/native";
import { Gesture } from "react-native-gesture-handler";
import {
  runOnJS,
  runOnUI,
  useSharedValue,
  useEvent,
} from "react-native-reanimated";
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
  const { feedActive, feedPage, feedIdle } = drawer;
  useFocusEffect(
    useCallback(() => {
      runOnUI(() => {
        "worklet";
        feedActive.value = true;
      })();
      return () => {
        runOnUI(() => {
          "worklet";
          feedActive.value = false;
        })();
      };
    }, [feedActive])
  );
  const current = useRef(0);
  const index = Math.max(0, categories.indexOf(selected));
  const pagePosition = useSharedValue(0);
  const onPageScroll = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      "worklet";
      pagePosition.value = event.position + event.offset;
      if (Math.abs(event.offset) > 0.001) feedIdle.value = false;
    },
    ["onPageScroll"]
  );
  const [mounted, setMounted] = useState(() => new Set(categories.slice(0, 2)));
  useEffect(() => {
    if (current.current === index) return;
    const distance = Math.abs(current.current - index);
    current.current = index;
    runOnUI((next: number, animated: boolean) => {
      "worklet";
      feedIdle.value = !animated;
      if (!animated) {
        feedPage.value = next;
        pagePosition.value = next;
      }
    })(index, distance <= 1);
    if (distance > 1) {
      ref.current?.setPageWithoutAnimation(index);
    } else ref.current?.setPage(index);
  }, [index, pagePosition, feedPage, feedIdle]);
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
  const updateWarmState = useCallback(
    (idle: boolean) => {
      moving.current = !idle;
      warm();
    },
    [warm]
  );
  const onPageScrollStateChanged = useEvent<PageScrollStateChangedNativeEvent>(
    (event) => {
      "worklet";
      const idle = event.pageScrollState === "idle";
      if (idle) feedPage.value = Math.round(pagePosition.value);
      feedIdle.value = idle;
      runOnJS(updateWarmState)(idle);
    },
    ["onPageScrollStateChanged"]
  );
  const selectPage = useCallback(
    (next: number) => {
      current.current = next;
      if (categories[next] !== undefined) onSelect(categories[next]);
    },
    [categories, onSelect]
  );
  const onPageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    (event) => {
      "worklet";
      feedPage.value = event.position;
      runOnJS(selectPage)(event.position);
    },
    ["onPageSelected"]
  );
  const gesture = drawer.gesture;
  const nativeGesture = useMemo(
    () => Gesture.Native().requireExternalGestureToFail(gesture),
    [gesture]
  );
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
