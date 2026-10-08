// Native navigation animations can run while JS is idle. Keep background work
// out of that interval instead of treating an idle callback as animation end.
const transitions = new Map<string, ReturnType<typeof setTimeout>>();
const waiting = new Set<() => void>();
export function beginRouteTransition(key: string) {
  endRouteTransition(key);
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
export function waitForInteractions() { return new Promise<void>(resolve => afterInteractions(resolve)); }
