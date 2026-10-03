import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

export const SHELL_BOTTOM_PADDING = 16;
export const SHELL_CHROME_THRESHOLD = 24;

type FeedChrome = {
  /** Binary state: 0 visible, 1 hidden. */
  hidden: SharedValue<number>;
  travel: SharedValue<number>;
  tabHeight: SharedValue<number>;
};
const Context = createContext<FeedChrome | null>(null);

/** Bottom navigation snaps after directional scroll travel crosses its threshold. */
export function FeedChromeProvider({ children }: { children: ReactNode }) {
  const hidden = useSharedValue(0);
  const travel = useSharedValue(0);
  const tabHeight = useSharedValue(80);
  const value = useMemo(
    () => ({ hidden, travel, tabHeight }),
    [hidden, travel, tabHeight]
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFeedChrome() {
  const value = useContext(Context);
  if (!value) throw new Error("FeedChromeProvider is required");
  return value;
}
