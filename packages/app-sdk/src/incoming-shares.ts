import { AppState, DeviceEventEmitter } from "react-native";
import { shell } from "../../platform/src/phone";
import { nativeResult } from "./native-result";
import type { IncomingShare } from "./index";

const cleanups = new Map<string, () => void>();
export function clearIncomingShares(appId: string) { cleanups.get(appId)?.(); cleanups.delete(appId); }
export function applicationIncomingShares(appId: string) {
  const listeners = new Set<(item: IncomingShare) => void>();
  let subscriptions: { remove: () => void }[] = [];
  let disposed = false, running = false, again = false;
  const list = async () => {
    if (disposed) throw new Error("应用已关闭");
    const result = await shell<{ ok: boolean; items?: IncomingShare[] }>("incomingShareList", { appId });
    if (disposed) throw new Error("应用已关闭");
    if (!result.ok) throw new Error("无法读取分享内容");
    return result.items ?? [];
  };
  const refresh = async () => {
    if (disposed || !listeners.size) return;
    if (running) { again = true; return; }
    running = true;
    try {
      do {
        again = false;
        for (const item of await list()) for (const listener of [...listeners]) {
          if (disposed || !listeners.has(listener)) continue;
          try { void Promise.resolve(listener(item)).catch(() => {}); } catch { /* Unacknowledged contents remain for an explicit retry. */ }
        }
      } while (again && !disposed && listeners.size);
    } catch { /* Query again on the next subscribe or resume. */ }
    finally { running = false; }
  };
  const stop = () => { subscriptions.forEach(item => item.remove()); subscriptions = []; };
  cleanups.set(appId, () => { disposed = true; listeners.clear(); stop(); });
  return {
    list,
    subscribe: (listener: (item: IncomingShare) => void) => {
      if (disposed || typeof listener !== "function") throw new Error("分享监听无效");
      listeners.add(listener);
      if (!subscriptions.length) subscriptions = [
        AppState.addEventListener("change", state => { if (state === "active") void refresh(); }),
        DeviceEventEmitter.addListener("zijinhua.incoming.share", () => { void refresh(); }),
      ];
      void refresh();
      return () => { listeners.delete(listener); if (!listeners.size) stop(); };
    },
    acknowledge: async (id: string) => {
      if (disposed) return { ok: false as const, code: "CANCELLED" as const, error: "应用已关闭" };
      if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("分享标识无效");
      return nativeResult(await shell("incomingShareAcknowledge", { appId, id }));
    },
  };
}
