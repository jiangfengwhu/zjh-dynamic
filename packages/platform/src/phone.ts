import { pluginCall } from "./pluginHost";

export type ShellResult = { ok: boolean; error?: string };

export function shell<T extends ShellResult>(method: string, payload: Record<string, unknown> = {}) {
  return pluginCall<T>("shell", method, payload);
}
