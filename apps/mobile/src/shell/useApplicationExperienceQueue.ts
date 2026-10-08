import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { afterInteractions } from "./interactionWork";
import type { MarketApplication } from "./market";

export const EXPERIENCE_AHEAD = 3;
const HISTORY_SIZE = 3;
export const experienceId = (item: MarketApplication) => `${item.manifest.appId}:${item.manifest.releaseId}`;

/** Stable page keys: current, three ahead, and three recently visited pages. */
export function experienceWindow(items: readonly MarketApplication[], index: number, history: readonly MarketApplication[]) {
  const wanted = items.slice(index, index + EXPERIENCE_AHEAD + 1);
  const keys = new Set(wanted.map(experienceId));
  let retained = 0;
  for (const item of history) {
    if (!keys.has(experienceId(item))) { wanted.push(item); keys.add(experienceId(item)); retained++; }
    if (retained >= HISTORY_SIZE) break;
  }
  return wanted;
}

export function useApplicationExperienceQueue(items: readonly MarketApplication[], index: number, enabled: boolean) {
  const current = items[index];
  const key = current && experienceId(current);
  const [history, setHistory] = useState<MarketApplication[]>([]);
  const [settled, setSettled] = useState<Set<string>>(() => new Set());
  const [warming, setWarming] = useState<string>();
  useLayoutEffect(() => {
    if (current) setHistory(prior => [current, ...prior.filter(item => experienceId(item) !== key)].slice(0, HISTORY_SIZE + 1));
  }, [key]);
  const entries = useMemo(() => experienceWindow(items, index, history), [items, index, history]);
  const onSettled = useCallback((id: string) => setSettled(prior => prior.has(id) ? prior : new Set([...prior, id])), []);
  useEffect(() => {
    const retained = new Set(entries.map(experienceId));
    setSettled(prior => [...prior].every(id => retained.has(id)) ? prior : new Set([...prior].filter(id => retained.has(id))));
  }, [entries]);
  useEffect(() => {
    setWarming(undefined);
    if (!enabled || !key || !settled.has(key)) return;
    const next = items.slice(index + 1, index + EXPERIENCE_AHEAD + 1).find(item => !settled.has(experienceId(item)));
    if (next) return afterInteractions(() => setWarming(experienceId(next)));
  }, [enabled, key, entries, settled]);
  return { entries, onSettled, canLoad: (id: string) => enabled && (id === key || id === warming || settled.has(id)) };
}
