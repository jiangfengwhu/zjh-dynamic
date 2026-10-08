import { useCallback, useEffect, useMemo, useRef } from "react";
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
  type PageScrollStateChangedNativeEvent,
} from "react-native-pager-view";
import { useFocusEffect } from "@react-navigation/native";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS, runOnUI, useEvent } from "react-native-reanimated";
import { useVisitedPager } from "../useVisitedPager";
import { useProfileDrawer } from "../ProfileDrawer";
export type FeedCategory = "recommended" | "following";

/** Native paging owns both directions; only the first page defers right swipes to the drawer. */
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
  const { feedActive, feedPage, feedPosition, feedIdle } = drawer;
  const index = Math.max(0, categories.indexOf(selected));
  const current = useRef(index);
  useFocusEffect(
    useCallback(() => {
      runOnUI((page: number) => {
        "worklet";
        feedActive.value = true;
        feedPage.value = page;
        feedPosition.value = page;
        feedIdle.value = true;
      })(current.current);
      return () => {
        runOnUI(() => {
          "worklet";
          feedActive.value = false;
        })();
      };
    }, [feedActive, feedPage, feedPosition, feedIdle])
  );
  const pagePosition = feedPosition;
  const { visited, visit: visitPage, reveal } = useVisitedPager(index);
  const mounted = useMemo(() => new Set(categories.filter((_, page) => visited.has(page))), [categories, visited]);
  useEffect(() => {
    visitPage(index);
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
    if (distance > 1) ref.current?.setPageWithoutAnimation(index);
    else ref.current?.setPage(index);
  }, [index, visitPage, pagePosition, feedPage, feedIdle]);
  const onPageScroll = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      "worklet";
      reveal(event.position, event.offset);
      pagePosition.value = event.position + event.offset;
      if (Math.abs(event.offset) > 0.001) feedIdle.value = false;
      else {
        feedPage.value = event.position;
        feedIdle.value = true;
      }
    },
    ["onPageScroll"]
  );
  const onPageScrollStateChanged = useEvent<PageScrollStateChangedNativeEvent>(
    event => {
      "worklet";
      const idle = event.pageScrollState === "idle";
      if (idle) feedPage.value = Math.round(pagePosition.value);
      feedIdle.value = idle;
    }, ["onPageScrollStateChanged"]
  );
  const selectPage = useCallback(
    (next: number) => {
      visitPage(next);
      current.current = next;
      if (categories[next] !== undefined) onSelect(categories[next]);
    },
    [categories, onSelect, visitPage]
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
