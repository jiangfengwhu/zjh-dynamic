// Native navigation animations can run while JS is idle. Keep background work
// out of that interval instead of treating an idle callback as animation end.
const transitions = new Map<string, ReturnType<typeof setTimeout>>();
const waiting = new Set<() => void>();
export function beginRouteTransition(key: string) {
  const prior = transitions.get(key);
  if (prior !== undefined) clearTimeout(prior);
  transitions.set(key, setTimeout(() => endRouteTransition(key), 700));
}
export function endRouteTransition(key: string) {
  const timer = transitions.get(key);
  if (timer !== undefined) clearTimeout(timer);
  transitions.delete(key);
  if (!transitions.size) {
    const ready = [...waiting]; waiting.clear();
    ready.forEach(run => run());
  }
}
export function afterInteractions(work: () => void) {
  let cancelled = false;
  let idle: number | undefined;
  let frame: number | undefined;
  const run = () => {
    if (cancelled) return;
    if (transitions.size) { waiting.add(run); return; }
    idle = requestIdleCallback(() => {
      if (cancelled) return;
      if (transitions.size) { waiting.add(run); return; }
      work();
    });
  };
  frame = requestAnimationFrame(() => { frame = requestAnimationFrame(run); });
  return () => { cancelled = true; waiting.delete(run); if (frame !== undefined) cancelAnimationFrame(frame); if (idle !== undefined) cancelIdleCallback(idle); };
}
export function waitForInteractions(signal?: AbortSignal) {
  signal?.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const cancel = afterInteractions(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    });
    const onAbort = () => { cancel(); reject(signal?.reason ?? new Error("操作已取消")); };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** User-visible loading waits for animations, but never waits for an idle slot. */
export function waitForRouteTransitions(signal?: AbortSignal) {
  signal?.throwIfAborted();
  if (!transitions.size) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const run = () => {
      if (transitions.size) { waiting.add(run); return; }
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => { waiting.delete(run); reject(signal?.reason ?? new Error("操作已取消")); };
    signal?.addEventListener("abort", abort, { once: true });
    waiting.add(run);
  });
}
