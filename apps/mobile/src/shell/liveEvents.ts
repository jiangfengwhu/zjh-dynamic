import { useEffect, useState } from "react";
import { subscribeAccountIdentity } from "./account";

export type LiveEvent = { type: "ready" | "message" | "read" | "notification" | "feed" | "work"; appId?: string; peerId?: string };
const listeners = new Set<(event: LiveEvent) => void>();
let pending = new Map<string, LiveEvent>();
let timer: ReturnType<typeof setTimeout> | undefined;
/** A one-shot burst merge, never a poller. Account changes discard queued events. */
export function dispatchLiveEvent(event: LiveEvent) {
  pending.set(`${event.type}:${event.appId ?? event.peerId ?? ""}`, event);
  if (timer !== undefined) return;
  timer = setTimeout(() => {
    timer = undefined;
    const events = [...pending.values()]; pending.clear();
    events.forEach(event => listeners.forEach(listener => listener(event)));
  }, 250);
}
subscribeAccountIdentity(() => { if (timer !== undefined) clearTimeout(timer); timer = undefined; pending.clear(); });
export function subscribeLiveEvents(listener: (event: LiveEvent) => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
export function useLiveVersion(type: LiveEvent["type"], appId?: string) {
  const [version, setVersion] = useState(0);
  useEffect(() => subscribeLiveEvents(event => {
    if (event.type === "ready" || event.type === type && (!appId || event.appId === appId)) setVersion(value => value + 1);
  }), [type, appId]);
  return version;
}
