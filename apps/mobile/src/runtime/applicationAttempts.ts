import { AppState, type NativeEventSubscription } from "react-native";
import { readShellValueSync, writeShellValue, removeShellValue } from "../shell/shellStorage";

type Attempt = { releaseId: string; host: string; interruptions: number; pending: boolean; foreground: boolean };
const attempts = new Map<string, Attempt>();
let subscription: NativeEventSubscription | undefined;
const key = (appId: string) => `application.interruptions.${appId}`;

function read(appId: string, releaseId: string, host: string): Attempt {
  try {
    const value = JSON.parse(readShellValueSync(key(appId)) || "null") as Attempt | null;
    if (value?.releaseId === releaseId && value.host === host && Number.isSafeInteger(value.interruptions) && value.interruptions >= 0 && typeof value.pending === "boolean" && typeof value.foreground === "boolean")
      return value;
  } catch { /* A malformed record cannot establish a failed attempt. */ }
  return { releaseId, host, interruptions: 0, pending: false, foreground: false };
}

/** Consume a previous process's unfinished attempt exactly once. */
export function consumeApplicationInterruption(appId: string, releaseId: string, host: string): number {
  const previous = read(appId, releaseId, host);
  const interruptions = previous.pending ? (previous.foreground ? previous.interruptions + 1 : 0) : previous.interruptions;
  writeShellValue(key(appId), JSON.stringify({ ...previous, interruptions, pending: false }));
  return interruptions;
}

export function beginApplicationAttempt(appId: string, releaseId: string, host: string) {
  const value = { ...read(appId, releaseId, host), pending: true, foreground: AppState.currentState === "active" };
  attempts.set(appId, value);
  writeShellValue(key(appId), JSON.stringify(value));
  subscription ??= AppState.addEventListener("change", state => {
    for (const [id, attempt] of attempts) {
      attempt.foreground = state === "active";
      writeShellValue(key(id), JSON.stringify(attempt));
    }
  });
}

export function clearApplicationAttempt(appId: string, releaseId?: string, reset = true) {
  if (releaseId) {
    try { if (JSON.parse(readShellValueSync(key(appId)) || "null")?.releaseId !== releaseId) return; }
    catch { return; }
  }
  attempts.delete(appId);
  if (reset) removeShellValue(key(appId));
  else {
    const raw = readShellValueSync(key(appId));
    if (raw) writeShellValue(key(appId), JSON.stringify({ ...JSON.parse(raw), pending: false }));
  }
  if (!attempts.size) { subscription?.remove(); subscription = undefined; }
}
