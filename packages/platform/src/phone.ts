import { pluginCall } from "./pluginHost";
import type { LocationResult } from "../../app-sdk/src/index";

export type ShellResult = { ok: boolean; error?: string };

export function shell<T extends ShellResult>(method: string, payload: Record<string, unknown> = {}) {
  return pluginCall<T>("shell", method, payload);
}

export const phone = {
  location: async (options?: { accuracy?: "fine" | "coarse" }): Promise<LocationResult> => {
    try {
      const result = await shell<{ ok: boolean; lat?: number; lng?: number; accuracy?: number; error?: string }>("location", { accuracy: options?.accuracy ?? "coarse" });
      if (result.ok && Number.isFinite(result.lat) && Number.isFinite(result.lng) && Number.isFinite(result.accuracy) && result.accuracy! >= 0) {
        return { ok: true, latitude: result.lat!, longitude: result.lng!, accuracy: result.accuracy! };
      }
      if (result.error === "permission") return { ok: false, code: "PERMISSION", error: "请先授予定位权限" };
      if (result.error === "timeout") return { ok: false, code: "TIMEOUT", error: "定位超时，请稍后重试" };
      return { ok: false, code: "UNAVAILABLE", error: "暂时无法定位，请检查系统定位开关" };
    } catch { return { ok: false, code: "UNAVAILABLE", error: "暂时无法定位，请检查系统定位开关" }; }
  },
  device: () => shell<{ ok: boolean; brand: string; model: string; sdk: number; battery: number; charging: boolean }>("device"),
  contacts: (query = "", limit = 40) =>
    shell<{ ok: boolean; items: { name: string; number: string }[] }>("contacts", { query, limit }),
  calendarEvents: (fromMs: number, toMs: number) =>
    shell<{ ok: boolean; items: { id: string; title: string; startMs: number; endMs: number }[] }>("calendarEvents", { fromMs, toMs }),
  calendarInsert: (title: string, startMs: number, endMs: number, description = "") =>
    shell<{ ok: boolean; id: string }>("calendarInsert", { title, startMs, endMs, description }),
  openUrl: (url: string) => shell("openUrl", { url }),
  notify: (id: string, title: string, body: string) => shell("notify", { id, title, body }),
  schedule: (id: string, title: string, body: string, atMs: number) => shell("schedule", { id, title, body, atMs }),
  healthStatus: () => shell<{ ok: boolean; status: string }>("healthStatus"),
  healthPermissions: () => shell<{ ok: boolean; granted?: string[]; error?: string }>("healthPermissions"),
  healthSummary: (fromMs: number, toMs: number) =>
    shell<{ ok: boolean; steps: number; heartRate: number; sleepMinutes: number }>("healthSummary", { fromMs, toMs }),
  requestHealth: () => shell<{ ok: boolean; granted: boolean }>("requestHealth"),
  motion: () => shell<{ ok: boolean; x: number; y: number; z: number }>("motion"),
  torch: (on: boolean) => shell("torch", { on }),
  keepAwake: (on: boolean) => shell("keepAwake", { on }),
  speak: (text: string) => shell("speak", { text }),
  bluetoothState: () => shell<{ ok: boolean; enabled: boolean }>("bluetoothState"),
  bluetoothDevices: () => shell<{ ok: boolean; items: { name: string; address: string }[] }>("bluetoothDevices"),
  bluetoothScan: (seconds = 4) =>
    shell<{ ok: boolean; items: { name: string; address: string; rssi: number }[] }>("bluetoothScan", { seconds }),
  nfcStatus: () => shell<{ ok: boolean; present: boolean; enabled: boolean }>("nfcStatus"),
  nfcRead: (seconds = 20) => shell<{ ok: boolean; id: string; text: string }>("nfcRead", { seconds }),
  smsList: (box: "inbox" | "sent" = "inbox", limit = 30) =>
    shell<{ ok: boolean; items: { address: string; body: string; dateMs: number }[] }>("smsList", { box, limit }),
  smsSend: (to: string, body: string) => shell("smsSend", { to, body }),
  callLog: (limit = 30) =>
    shell<{ ok: boolean; items: { number: string; name: string; type: string; dateMs: number; durationSec: number }[] }>("callLog", { limit }),
};
