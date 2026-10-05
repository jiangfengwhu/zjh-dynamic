import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  Easing,
  ReduceMotion,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

export const SHELL_BOTTOM_PADDING = 16;
export const SHELL_CHROME_THRESHOLD = 24;

type FeedChrome = {
  /** Animated visual progress. */
  hidden: SharedValue<number>;
  /** Binary destination: 0 visible, 1 hidden. */
  target: SharedValue<number>;
  travel: SharedValue<number>;
  tabHeight: SharedValue<number>;
};
const Context = createContext<FeedChrome | null>(null);

/** Threshold changes a binary target; a short timing transition always finishes. */
export function FeedChromeProvider({ children }: { children: ReactNode }) {
  const hidden = useSharedValue(0);
  const target = useSharedValue(0);
  useAnimatedReaction(
    () => target.value,
    (next, previous) => {
      if (next === previous) return;
      hidden.value = withTiming(next, {
        duration: 180,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      });
    }
  );
  const travel = useSharedValue(0);
  const tabHeight = useSharedValue(80);
  const value = useMemo(
    () => ({ hidden, target, travel, tabHeight }),
    [hidden, target, travel, tabHeight]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFeedChrome() {
  const value = useContext(Context);
  if (!value) throw new Error("FeedChromeProvider is required");
  return value;
}
