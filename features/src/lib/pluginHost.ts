import { TurboModuleRegistry, type TurboModule } from "react-native";

interface NativePluginHostSpec extends TurboModule {
  call: (pluginId: string, method: string, payload: string) => Promise<string>;
}

let cachedHost: NativePluginHostSpec | null | undefined;

function getNativePluginHost(): NativePluginHostSpec | null {
  if (cachedHost !== undefined) {
    return cachedHost;
  }
  try {
    cachedHost = TurboModuleRegistry.get<NativePluginHostSpec>("NativePluginHost");
  } catch {
    cachedHost = null;
  }
  if (!cachedHost?.call) {
    cachedHost = null;
  }
  return cachedHost;
}

export async function pluginCall<T = unknown>(
  pluginId: string,
  method: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const host = getNativePluginHost();
  if (!host) {
    throw new Error("NativePluginHost unavailable");
  }
  const raw = await host.call(pluginId, method, JSON.stringify(payload));
  if (raw == null || raw === "") {
    return undefined as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}

export function isPluginHostAvailable(): boolean {
  return getNativePluginHost() != null;
}
