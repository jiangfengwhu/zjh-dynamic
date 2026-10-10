import { useCallback, useLayoutEffect, useRef } from "react";

/** Stable UI handler with the latest committed state; never use during render. */
export function useEventCallback<Args extends unknown[], Result>(handler: (...args: Args) => Result) {
  const current = useRef(handler);
  useLayoutEffect(() => { current.current = handler; });
  return useCallback((...args: Args): Result => current.current(...args), []);
}
