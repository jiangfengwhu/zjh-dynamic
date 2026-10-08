import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadPublicApplicationExperience } from "../runtime/applications";
import { afterInteractions } from "./interactionWork";
import type { MarketApplication } from "./market";

export const EXPERIENCE_AHEAD = 3;
const HISTORY_SIZE = 3;
export const EXPERIENCE_CACHE_SIZE = 1 + EXPERIENCE_AHEAD + HISTORY_SIZE;
export const experienceId = (item: MarketApplication) => `${item.manifest.appId}:${item.manifest.releaseId}`;
type Preparation = { ready: boolean; downloaded?: boolean; error: string };

/** At most seven identities: current, three ahead and three recently visited. */
export function experienceWindow(items: readonly MarketApplication[], index: number, history: readonly MarketApplication[]) {
  const wanted = items.slice(index, index + EXPERIENCE_AHEAD + 1);
  const keys = new Set(wanted.map(experienceId));
  let retained = 0;
  // Always include the preceding feed page, even after reversing beyond history.
  const previous = items.slice(Math.max(0, index - 1), index);
  for (const item of [...previous, ...history]) {
    if (!keys.has(experienceId(item))) { wanted.push(item); keys.add(experienceId(item)); retained++; }
    if (retained >= HISTORY_SIZE) break;
  }
  return wanted;
}

/** Resource warming is independent of FlashList's mounted cells. */
export function useApplicationExperienceQueue(items: readonly MarketApplication[], index: number, enabled: boolean, executeEnabled = enabled) {
  const current = items[index];
  const key = current && experienceId(current);
  const [visits, setVisits] = useState<{ key: string | undefined; history: MarketApplication[] }>(() => ({ key, history: current ? [current] : [] }));
  // Adjust this component's state before commit, rather than committing the old
  // history and then forcing a second list layout from a layout effect.
  if (visits.key !== key) setVisits({ key, history: current ? [current, ...visits.history.filter(item => experienceId(item) !== key)].slice(0, HISTORY_SIZE + 1) : [] });
  const entries = useMemo(() => experienceWindow(items, index, visits.history), [items, index, visits.history]);
  const [preparations, setPreparations] = useState<Map<string, Preparation>>(() => new Map());
  useEffect(() => {
    const retained = new Set(entries.map(experienceId));
    setPreparations(prior => [...prior.keys()].every(id => retained.has(id)) ? prior : new Map([...prior].filter(([id]) => retained.has(id))));
  }, [entries]);
  const latest = useRef(preparations); latest.current = preparations;
  const [retryVersion, setRetryVersion] = useState(0);
  // Downloads start immediately, including during a swipe. The native resource
  // scheduler merges identities and limits actual transfers to three.
  useEffect(() => {
    if (!enabled || !current) return;
    const controller = new AbortController();
    for (const candidate of entries) {
      const id = experienceId(candidate);
      if (latest.current.get(id)?.downloaded || latest.current.get(id)?.error) continue;
      void loadPublicApplicationExperience(candidate.manifest, controller.signal, candidate, true).then(() => {
        if (!controller.signal.aborted) setPreparations(prior => new Map(prior).set(id, { ...prior.get(id), ready: prior.get(id)?.ready ?? false, downloaded: true, error: "" }));
      }, cause => {
        if (!controller.signal.aborted) setPreparations(prior => new Map(prior).set(id, { ready: false, error: cause instanceof Error ? cause.message : "作品下载失败" }));
      });
    }
    return () => controller.abort();
  }, [enabled, key, entries, retryVersion]);
  // Only evaluation uses idle scheduling. Completed downloads free their slot
  // immediately, so waiting for JS never blocks the next transfer.
  useEffect(() => {
    if (!executeEnabled || !current) return;
    const next = entries.find(item => {
      const state = preparations.get(experienceId(item));
      return state?.downloaded && !state.ready && !state.error;
    });
    if (!next) return;
    const controller = new AbortController();
    const cancel = afterInteractions(() => {
      void loadPublicApplicationExperience(next.manifest, controller.signal, next).then(() => {
        if (!controller.signal.aborted) setPreparations(prior => new Map(prior).set(experienceId(next), { ready: true, downloaded: true, error: "" }));
      }, cause => {
        if (!controller.signal.aborted) setPreparations(prior => new Map(prior).set(experienceId(next), { ready: false, downloaded: true, error: cause instanceof Error ? cause.message : "暂时无法体验这个作品" }));
      });
    });
    return () => { cancel(); controller.abort(); };
  }, [executeEnabled, key, entries, preparations]);
  const retry = useCallback((id: string) => {
    setPreparations(prior => { const next = new Map(prior); next.delete(id); return next; });
    setRetryVersion(value => value + 1);
  }, []);
  return { entries, preparations, retry };
}
