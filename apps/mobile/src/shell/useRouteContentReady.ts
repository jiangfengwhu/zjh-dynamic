import { useEffect, useState } from "react";
import { useNavigation, useIsFocused, type ParamListBase } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

/** Requests need a committed route, not a completed entrance animation. */
export function useRouteRequestReady(embedded = false) {
  const focused = useIsFocused();
  const [ready, setReady] = useState(embedded);
  useEffect(() => {
    if (embedded || ready || !focused) return;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [embedded, ready, focused]);
  return ready;
}

/** Commit the route shell before mounting costly content or starting sync. */
export function useRouteContentReady(embedded = false) {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const focused = useIsFocused();
  const [ready, setReady] = useState(embedded);
  useEffect(() => {
    if (embedded || ready || !focused) return;
    let finished = false;
    const finish = () => {
      clearTimeout(fallback);
      if (finished) return;
      finished = true;
      setReady(true);
    };
    const off = navigation.addListener("transitionEnd", (event) => {
      if (!event.data.closing) finish();
    });
    // No-animation navigation and restored routes may have no entrance event.
    const fallback = setTimeout(finish, 320);
    return () => {
      off();
      clearTimeout(fallback);
    };
  }, [embedded, navigation, focused, ready]);
  return ready;
}
