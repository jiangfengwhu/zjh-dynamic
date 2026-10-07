import { pluginCall } from "./pluginHost";

export type AiProvider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isDefault: boolean;
};

export function shellProviders() {
  return pluginCall<{ ok: boolean; items: AiProvider[] }>("shell", "providers", {});
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
