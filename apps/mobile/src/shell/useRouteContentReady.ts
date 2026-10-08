import { useEffect, useState } from "react";
import { useIsFocused } from "@react-navigation/native";
import { afterInteractions } from "./interactionWork";

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
  const focused = useIsFocused();
  const [ready, setReady] = useState(embedded);
  useEffect(() => {
    if (embedded || ready || !focused) return;
    // Also works when a lazy screen mounts after transitionEnd has fired.
    return afterInteractions(() => setReady(true));
  }, [embedded, focused, ready]);
  return ready;
}
