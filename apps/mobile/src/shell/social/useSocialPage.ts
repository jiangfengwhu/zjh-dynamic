import { afterInteractions, waitForRouteTransitions } from "../interactionWork";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { cachedPage, pageCacheKey, rememberPage } from "../pageCache";
import { useAccount } from "../account";
import { useRouteRequestReady } from "../useRouteContentReady";

/** Account-scoped cached pages; one flight and a queued event-driven refresh. */
export function useSocialPage<T extends { nextCursor: string | null }>({ name, empty, read, merge, active = true, version = 0, authenticated = false, backgroundRefresh = false }: {
  name: string; empty: T; read: (cursor?: string) => Promise<T>; merge: (previous: T, next: T, more: boolean) => T;
  active?: boolean; version?: number; authenticated?: boolean; backgroundRefresh?: boolean;
}) {
  const { user } = useAccount();
  const isFocused = useIsFocused(), routeReady = useRouteRequestReady();
  const focused = isFocused && routeReady && active && (!authenticated || !!user);
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const canRead = focused || backgroundRefresh && foreground && (!authenticated || !!user);
  const key = pageCacheKey(name);
  const [state, setState] = useState(() => ({ key, data: cachedPage<T>(key) ?? empty }));
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const data = state.key === key ? state.data : cachedPage<T>(key) ?? empty;
  const dataRef = useRef(data); dataRef.current = data;
  const config = useRef({ read, merge }); config.current = { read, merge };
  const identity = useRef(key); identity.current = key;
  const alive = useRef(true), canReadRef = useRef(canRead); canReadRef.current = canRead;
  const flight = useRef<{ key: string } | undefined>(undefined), again = useRef(false);
  const reload = useRef<(more?: boolean) => Promise<boolean>>(async () => false);
  const commit = useCallback((next: T) => { const shared = rememberPage(key, next); dataRef.current = shared; setState(previous => previous.key === key && previous.data === shared ? previous : { key, data: shared }); }, [key]);
  const load = useCallback(async (more = false): Promise<boolean> => {
    if (!canReadRef.current || (more && !dataRef.current.nextCursor)) return false;
    if (flight.current?.key === key) { if (!more) again.current = true; return false; }
    const token = { key }; flight.current = token; setLoading(true); setError("");
    try {
      const next = await config.current.read(more ? dataRef.current.nextCursor! : undefined);
      // First content and explicit refresh commit without waiting for idle.
      await waitForRouteTransitions();
      if (!alive.current || identity.current !== key) return false;
      commit(config.current.merge(dataRef.current, next, more));
      return true;
    } catch (cause) {
      if (alive.current && identity.current === key) setError(cause instanceof Error ? cause.message : "同步未完成，请重试");
      return false;
    } finally {
      if (flight.current === token) {
        flight.current = undefined;
        if (alive.current && identity.current === key) {
          setLoading(false);
          if (again.current) { again.current = false; void reload.current(); }
        }
      }
    }
  }, [key, commit]);
  reload.current = load;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!backgroundRefresh) return;
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => subscription.remove();
  }, [backgroundRefresh]);
  useEffect(() => { setError(""); again.current = false; }, [key]);
  useEffect(() => {
    if (!canRead) return;
    const cached = cachedPage(key) !== undefined;
    const run = () => { void reload.current(); };
    const cancel = cached ? afterInteractions(run) : (() => { const frame = requestAnimationFrame(run); return () => cancelAnimationFrame(frame); })();
    return cancel;
  }, [canRead, focused, key, version]);
  const update = useCallback((change: (previous: T) => T) => commit(change(dataRef.current)), [commit]);
  return { data, load, commit, update, loading, error, loaded: !!cachedPage(key), focused, user };
}
