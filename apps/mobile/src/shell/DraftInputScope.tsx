import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { writeShellValue, removeShellValue } from "./shellStorage";

/** Typing updates only the composer, never its surrounding list. */
export function useDraftText() {
  return useState(() => {
    let text = ""; const listeners = new Set<() => void>();
    return {
      get text() { return text; },
      setText(value: string) { if (value === text) return; text = value; listeners.forEach(listener => listener()); },
      subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
      snapshot() { return text; },
    };
  })[0];
}
export type DraftText = ReturnType<typeof useDraftText>;
export function useDraftPersistence(draft: DraftText, key: string | undefined, ready: boolean) {
  useEffect(() => {
    if (!ready || !key) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: string | undefined;
    const flush = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      if (pending === undefined) return;
      const text = pending; pending = undefined;
      if (text) writeShellValue(key, text); else removeShellValue(key);
    };
    const unsubscribe = draft.subscribe(() => { pending = draft.text; if (timer !== undefined) clearTimeout(timer); timer = setTimeout(flush, 180); });
    return () => { unsubscribe(); flush(); };
  }, [draft, key, ready]);
}
export function DraftInputScope({ draft, children }: { draft: DraftText; children: (text: string, setText: (text: string) => void, count: number) => ReactNode }) {
  const text = useSyncExternalStore(draft.subscribe, draft.snapshot, draft.snapshot);
  return children(text, draft.setText, Array.from(text).length);
}
