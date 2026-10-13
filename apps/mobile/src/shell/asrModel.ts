import { DeviceEventEmitter } from "react-native";
import { useSyncExternalStore } from "react";
import { shell } from "../../../../packages/platform/src/phone";

type ModelState = { loaded: boolean; ready: boolean; downloading: boolean; cancelling: boolean; deleting: boolean; received: number; total: number; storedBytes: number; inUse: boolean; error?: string };
let state: ModelState = { loaded: false, ready: false, downloading: false, cancelling: false, deleting: false, received: 0, total: 0, storedBytes: 0, inUse: false };
let downloading: Promise<boolean> | undefined;
const listeners = new Set<() => void>();
const pending = new Set<{ complete: (value: boolean) => void }>();
let requestVersion = 0;
function notify() { listeners.forEach(listener => listener()); }
function apply(value: Partial<ModelState>) {
  const next = { ...state, ...value };
  if (Object.keys(next).some(key => next[key as keyof ModelState] !== state[key as keyof ModelState])) { state = next; notify(); }
  if (state.ready && !state.downloading && !state.deleting) finishModelPrompt(true);
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function useAsrModel() { return useSyncExternalStore(subscribe, () => state); }
export function useAsrModelPrompt() { return useSyncExternalStore(subscribe, () => requestVersion); }
export function modelPromptOpen() { return pending.size > 0; }
export async function refreshAsrModel() {
  const value = await shell<ModelState & { ok: boolean }>("asrModelStatus");
  if (!value.ok) throw new Error("语音模型状态读取失败");
  apply({ ...value, loaded: true, error: value.error });
  return state;
}
export function watchAsrModel() {
  const listener = DeviceEventEmitter.addListener("zijinhua.asr-model", event => {
    try { const value = JSON.parse(event.payload); apply({ ...value, loaded: true, error: value.error }); } catch {}
  });
  return () => listener.remove();
}
export async function prepareAsrModel(signal: AbortSignal) {
  if (signal.aborted) return false;
  const current = await refreshAsrModel();
  if (signal.aborted) return false;
  if (current.ready && !current.deleting) return true;
  return new Promise<boolean>(resolve => {
    const request = { complete: (value: boolean) => { signal.removeEventListener("abort", abort); resolve(value); } };
    const abort = () => { if (pending.delete(request)) { request.complete(false); requestVersion++; notify(); } };
    pending.add(request); signal.addEventListener("abort", abort, { once: true });
    requestVersion++; notify(); if (signal.aborted) abort();
    else if (state.ready && !state.downloading && !state.deleting) finishModelPrompt(true);
  });
}
export function finishModelPrompt(value: boolean) {
  if (!pending.size) return;
  const requests = [...pending]; pending.clear(); requestVersion++; notify(); requests.forEach(request => request.complete(value));
}
export function downloadAsrModel() {
  if (downloading) return downloading;
  if (state.ready) return Promise.resolve(true);
  if (state.cancelling || state.deleting) return Promise.resolve(false);
  apply({ downloading: true, error: undefined });
  downloading = (async () => {
    try {
      const value = await shell<{ ok: boolean; error?: string }>("asrModelDownload");
      await refreshAsrModel();
      if (!value.ok && value.error !== "cancel") apply({ error: state.error || (value.error === "busy" ? "模型正在处理，请稍后重试" : value.error || "模型下载失败，请重试") });
      return state.ready;
    } catch { apply({ downloading: false, cancelling: false, error: "模型下载失败，请检查网络后重试" }); return false; }
    finally { downloading = undefined; }
  })();
  return downloading;
}
export async function cancelAsrModel() {
  apply({ cancelling: true });
  try { await shell("asrModelCancel"); await refreshAsrModel(); }
  catch { apply({ cancelling: false, error: "暂时无法取消下载，请重试" }); }
}
export async function deleteAsrModel() {
  apply({ deleting: true, error: undefined });
  try {
    const value = await shell<ModelState & { ok: boolean; error?: string }>("asrModelDelete");
    if (!value.ok) { apply({ deleting: false, error: value.error === "busy" ? "模型正在使用，请结束语音录入后重试" : value.error || "模型删除失败，请重试" }); return; }
    apply({ ...value, loaded: true, error: undefined });
  } catch { apply({ deleting: false, error: "模型删除失败，请重试" }); }
}
