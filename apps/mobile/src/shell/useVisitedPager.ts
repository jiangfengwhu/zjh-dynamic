import { useCallback, useState } from "react";
import { runOnJS, useSharedValue } from "react-native-reanimated";

/** Keep page shells for native swiping; mount content only when revealed. */
export function useVisitedPager(initialIndex = 0) {
  const [visited, setVisited] = useState(() => new Set([initialIndex]));
  const first = useSharedValue(initialIndex);
  const last = useSharedValue(initialIndex);
  const visit = useCallback((index: number) => {
    setVisited(previous => previous.has(index) ? previous : new Set(previous).add(index));
  }, []);
  const reveal = useCallback((position: number, offset: number) => {
    "worklet";
    const end = offset > 0.001 ? position + 1 : position;
    if (first.value !== position) {
      first.value = position;
      runOnJS(visit)(position);
    }
    if (last.value !== end) {
      last.value = end;
      runOnJS(visit)(end);
    }
  }, [first, last, visit]);
  return { visited, visit, reveal };
}
