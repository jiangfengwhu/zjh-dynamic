import { pluginCall } from "./pluginHost";

export type ForegroundType = "dataSync" | "mediaPlayback" | "location" | "camera" | "microphone" | "connectedDevice";

export function shellCapabilities() {
  return pluginCall<{ ok: boolean; methods: string[] }>("shell", "capabilities", {});
}

export function shellNotify(input: { id: string; title: string; body?: string }) {
  return pluginCall("shell", "notify", input);
}

export function shellSchedule(input: { id: string; title: string; body?: string; atMs: number }) {
  return pluginCall<{ ok: boolean; id: string; atMs: number; exact: boolean }>("shell", "schedule", input);
}

export function shellCancelSchedule(id: string) {
  return pluginCall("shell", "cancelSchedule", { id });
}

export function shellSchedules() {
  return pluginCall<{ ok: boolean; items: { id: string; title: string; body: string; atMs: number }[] }>(
    "shell",
    "schedules",
    {},
  );
}

export function shellStartForeground(input: { title: string; body?: string; type?: ForegroundType }) {
  return pluginCall("shell", "startForeground", input);
}

export function shellStopForeground() {
  return pluginCall("shell", "stopForeground", {});
}

export function shellShare(input: { text?: string; title?: string; path?: string; mime?: string }) {
  return pluginCall("shell", "share", input);
}

export function shellOpenSettings(target: "app" | "notifications" | "exactAlarms" = "app") {
  return pluginCall("shell", "openSettings", { target });
}

export function shellAuthenticate(input?: { title?: string; subtitle?: string }) {
  return pluginCall<{ ok: boolean; error?: string }>("shell", "authenticate", input ?? {});
}

export function shellLocation(accuracy: "fine" | "coarse" = "fine") {
  return pluginCall<{ ok: boolean; lat?: number; lng?: number; accuracy?: number; error?: string }>(
    "shell",
    "location",
    { accuracy },
  );
}

export function shellPick(kind: "image" | "video" | "audio" | "file" = "file") {
  return pluginCall<{ ok: boolean; path?: string; name?: string; error?: string }>("shell", "pick", { kind });
}

export function shellCapturePhoto() {
  return pluginCall<{ ok: boolean; path?: string; error?: string }>("shell", "capturePhoto", {});
}

export function shellInstallPackage(path: string) {
  return pluginCall("shell", "installPackage", { path });
}

export type ThemeMode = "light" | "dark";

export type AiProvider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
};

export function shellAppearance(mode?: ThemeMode) {
  return pluginCall<{ ok: boolean; mode: ThemeMode }>("shell", "appearance", mode ? { mode } : {});
}

export function shellSystemBars(colors: { statusBar: string; navigationBar?: string; window?: string; light?: boolean }) {
  return pluginCall<{ ok: boolean; error?: string }>("shell", "systemBars", colors);
}

export function shellProviders() {
  return pluginCall<{ ok: boolean; items: AiProvider[] }>("shell", "providers", {});
}

export type ListedAiProvider = {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
};

export async function listAiProviders(): Promise<ListedAiProvider[]> {
  const result = await shellProviders();
  return (result.items ?? []).map(({ id, name, baseUrl, model, isDefault }) => ({
    id,
    name,
    baseUrl,
    model,
    isDefault,
  }));
}

export function shellSaveProvider(input: Partial<AiProvider> & { name: string; baseUrl: string; model: string }) {
  return pluginCall<{ ok: boolean; id?: string; error?: string }>("shell", "saveProvider", input);
}

export function shellDeleteProvider(id: string) {
  return pluginCall("shell", "deleteProvider", { id });
}

export function shellComplete(input: {
  providerId?: string;
  model?: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
}) {
  return pluginCall<{ ok: boolean; text?: string; providerId?: string; model?: string; error?: string }>(
    "shell",
    "complete",
    input,
  );
}
