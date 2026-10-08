import NativePluginHost from "../NativePluginHost";
import type { ApplicationManifest } from "../../../../packages/app-sdk/src/index";

const LIMIT = 3;
type Download = {
  key: string;
  manifest: ApplicationManifest;
  signals: Set<AbortSignal>;
  uncancellable: boolean;
  started: boolean;
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
};
const flights = new Map<string, Download>();
const prepared = new Set<string>();
const queue: Download[] = [];
const activeApps = new Set<string>();
let active = 0;

function drain() {
  for (let index = 0; index < queue.length;) {
    const task = queue[index];
    if (!task.uncancellable && [...task.signals].every(signal => signal.aborted)) {
      queue.splice(index, 1);
      flights.delete(task.key);
      const error = new Error("下载预热已取消"); error.name = "AbortError";
      task.reject(error);
      continue;
    }
    if (active >= LIMIT || activeApps.has(task.manifest.appId)) { index++; continue; }
    queue.splice(index, 1);
    task.started = true;
    active++; activeApps.add(task.manifest.appId);
    // The native loader downloads bytes on its worker pool.
    // Once started, let it finish even if its feed page moves out of view.
    void NativePluginHost.call("shell", "prepareApplication", JSON.stringify(task.manifest)).then(() => {
      prepared.add(task.key);
      while (prepared.size > 16) prepared.delete(prepared.values().next().value!);
      task.resolve();
    }, task.reject).finally(() => {
      flights.delete(task.key);
      active--; activeApps.delete(task.manifest.appId);
      drain();
    });
  }
}

/** Bounded native downloads, independent of gestures and JS evaluation. */
export function downloadApplicationResources(manifest: ApplicationManifest, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const key = JSON.stringify([manifest.appId, manifest.releaseId, manifest.source.commit,
    manifest.bundle, manifest.assets]);
  if (prepared.has(key)) return Promise.resolve();
  let task = flights.get(key);
  if (!task) {
    let resolve!: () => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
    task = { key, manifest, signals: new Set(), uncancellable: false, started: false, promise, resolve, reject };
    flights.set(key, task); queue.push(task);
  }
  if (signal) task.signals.add(signal);
  else task.uncancellable = true;
  const flight = task;
  const onAbort = () => { if (!flight.started) drain(); };
  signal?.addEventListener("abort", onAbort, { once: true });
  drain();
  return flight.promise.finally(() => signal?.removeEventListener("abort", onAbort));
}
