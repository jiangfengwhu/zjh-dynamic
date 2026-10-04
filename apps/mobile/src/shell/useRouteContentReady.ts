import { useEffect, useState } from "react";
import { useNavigation, useIsFocused, type ParamListBase } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

/** Commit the route shell before mounting costly content or starting sync. */
export function useRouteContentReady(embedded = false) {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const focused = useIsFocused();
  const [ready, setReady] = useState(embedded);
  useEffect(() => {
    if (embedded || ready || !focused) return;
    let pending: ReturnType<typeof requestIdleCallback> | undefined;
    const finish = () => {
      clearTimeout(fallback);
      if (pending !== undefined) return;
      pending = requestIdleCallback(() => setReady(true));
    };
    const off = navigation.addListener("transitionEnd", (event) => {
      if (!event.data.closing) finish();
    });
    // No-animation navigation and restored routes may have no entrance event.
    const fallback = setTimeout(finish, 320);
    return () => {
      off();
      clearTimeout(fallback);
      if (pending !== undefined) cancelIdleCallback(pending);
    };
  }, [embedded, navigation, focused, ready]);
  return ready;
}
