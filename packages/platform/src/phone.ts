import { pluginCall } from "./pluginHost";
import Clipboard from "@react-native-clipboard/clipboard";

export type ShellResult = { ok: boolean; error?: string };

export function shell<T extends ShellResult>(method: string, payload: Record<string, unknown> = {}) {
  return pluginCall<T>("shell", method, payload);
}

export const phone = {
  device: () => shell<{ ok: boolean; brand: string; model: string; sdk: number; battery: number; charging: boolean }>("device"),
  clipboardGet: async () => ({ ok: true, text: await Clipboard.getString() }),
  clipboardSet: async (text: string) => { Clipboard.setString(text); return { ok: true }; },
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
  vibrate: (ms = 40) => shell("vibrate", { ms }),
  motion: () => shell<{ ok: boolean; x: number; y: number; z: number }>("motion"),
  torch: (on: boolean) => shell("torch", { on }),
  keepAwake: (on: boolean) => shell("keepAwake", { on }),
  speak: (text: string) => shell("speak", { text }),
  fileRead: (path: string) => shell<{ ok: boolean; text: string }>("fileRead", { path }),
  fileWrite: (path: string, text: string) => shell<{ ok: boolean; bytes: number }>("fileWrite", { path, text }),
  fileList: (path = "") => shell<{ ok: boolean; items: { name: string; dir: boolean; bytes: number }[] }>("fileList", { path }),
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
