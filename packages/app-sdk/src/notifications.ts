import { AppState, Linking } from "react-native";
import { shell } from "../../platform/src/phone";
import { normalizeShareParams } from "./sharing";
import type { NotificationEvent, NotificationOptions, NotificationStatus, ReminderOptions, ReminderResult, ShellResult } from "./index";

const cleanup = new Map<string, () => void>();
export function clearApplicationNotifications(appId: string) { cleanup.get(appId)?.(); cleanup.delete(appId); }

export function applicationNotifications(appId: string, reminderId: (id: string) => string, getAppName: () => string) {
  const listeners = new Set<(event: NotificationEvent) => void>();
  let running = false;
  let again = false;
  let disposed = false;
  let subscriptions: { remove: () => void }[] = [];
  const refresh = async () => {
    if (disposed || !listeners.size) return;
    if (running) { again = true; return; }
    running = true;
    try {
      do {
        again = false;
        const result = await shell<{ ok: boolean; items?: NotificationEvent[] }>("notificationEvents", { appId });
        if (result.ok) for (const event of result.items ?? []) for (const listener of [...listeners]) {
          if (disposed || !listeners.has(listener)) continue;
          try { void Promise.resolve(listener({ ...event, params: normalizeShareParams(event.params) ?? {} })).catch(() => {}); }
          catch { console.warn("通知事件处理失败"); }
        }
      } while (again && !disposed && listeners.size);
    } catch { /* Pending events remain on disk for the next subscribe/resume. */ }
    finally { running = false; }
  };
  const stop = () => { listeners.clear(); subscriptions.forEach(item => item.remove()); subscriptions = []; };
  cleanup.set(appId, () => { disposed = true; stop(); });
  const options = (value: ReminderOptions = {}) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("提醒选项无效");
    return { params: normalizeShareParams(value.params), actions: value.actions, repeat: value.repeat, appName: getAppName() };
  };
  return {
    cancelAllSchedules: () => shell("cancelAllSchedules", { appId }),
    notificationStatus: () => shell<NotificationStatus>("notificationStatus", { appId, appName: getAppName() }),
    notificationSettings: (kind: "notifications" | "exact" = "notifications") => shell("notificationSettings", { appId, appName: getAppName(), exact: kind === "exact" }),
    notify: (id: string, title: string, body: string, value?: NotificationOptions) => shell("notify", { id: reminderId(id), title, body, options: options(value) }),
    schedule: (id: string, title: string, body: string, atMs: number, value?: ReminderOptions) => {
      if (!Number.isSafeInteger(atMs) || atMs < 0) throw new Error("提醒时间无效");
      return shell<ReminderResult>("schedule", { id: reminderId(id), title, body, atMs, options: options(value) });
    },
    onNotification: (listener: (event: NotificationEvent) => void) => {
      if (disposed || typeof listener !== "function") throw new Error("通知监听无效或应用已关闭");
      listeners.add(listener);
      if (!subscriptions.length) subscriptions = [
        AppState.addEventListener("change", state => { if (state === "active") void refresh(); }),
        Linking.addEventListener("url", ({ url }) => { if (url.includes("notification=")) void refresh(); }),
      ];
      void refresh();
      return () => { listeners.delete(listener); if (!listeners.size) { stop(); } };
    },
    acknowledgeNotification: async (token: string): Promise<ShellResult> => {
      if (typeof token !== "string" || !/^[a-f0-9-]{36}$/.test(token)) throw new Error("通知事件标识无效");
      const result = await shell("notificationEvents", { appId, ack: [token] });
      return { ok: result.ok };
    },
  };
}
