import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

type FeedChrome = { hidden: SharedValue<number>; tabHeight: SharedValue<number> };
const Context = createContext<FeedChrome | null>(null);

/** Header and bottom navigation share scroll progress on the UI thread. */
export function FeedChromeProvider({ children }: { children: ReactNode }) {
  const hidden = useSharedValue(0);
  const tabHeight = useSharedValue(80);
  const value = useMemo(() => ({ hidden, tabHeight }), [hidden, tabHeight]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFeedChrome() {
  const value = useContext(Context);
  if (!value) throw new Error("FeedChromeProvider is required");
  return value;
}
