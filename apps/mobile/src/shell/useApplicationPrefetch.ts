import { useEffect } from "react";
import { useNetInfo } from "@react-native-community/netinfo";
import { prefetchPublicApplicationExperience, type ApplicationManifest } from "../runtime/applications";
import { afterInteractions } from "./interactionWork";

export const APPLICATION_PREFETCH_AHEAD = 3;
const WINDOW_BYTES = 12 * 1024 * 1024;
const METERED_BYTES = 3 * 1024 * 1024;

function idleBeforePrefetch(signal: AbortSignal): Promise<boolean> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(false); return; }
    const finish = () => { signal.removeEventListener("abort", stop); resolve(!signal.aborted); };
    const cancel = afterInteractions(finish);
    const stop = () => { cancel(); finish(); };
    signal.addEventListener("abort", stop, { once: true });
  });
}

/** Limit pending work, rather than claiming a cap on the native persistent cache. */
export function applicationPrefetchWindow(manifests: readonly ApplicationManifest[], metered: boolean) {
  let budget = metered ? METERED_BYTES : WINDOW_BYTES;
  const selected: ApplicationManifest[] = [];
  for (const manifest of manifests.slice(0, metered ? 1 : APPLICATION_PREFETCH_AHEAD)) {
    const sizes = [manifest.bundle?.bytes, ...(Array.isArray(manifest.assets) ? manifest.assets.map(asset => asset.bytes) : [NaN])];
    if (sizes.some(bytes => !Number.isSafeInteger(bytes) || bytes <= 0)) continue;
    const bytes = sizes.reduce((sum, size) => sum + size, 0);
    if (bytes > budget) continue;
    budget -= bytes;
    selected.push(manifest);
  }
  return selected;
}

export function useApplicationPrefetch(manifests: readonly ApplicationManifest[], enabled: boolean) {
  const network = useNetInfo();
  const disconnected = network.isConnected === false || network.isInternetReachable === false;
  const metered = network.details?.isConnectionExpensive === true;
  useEffect(() => {
    if (!enabled || disconnected || !manifests.length) return;
    const controller = new AbortController();
    const run = async () => {
      for (const manifest of applicationPrefetchWindow(manifests, metered)) {
        if (!await idleBeforePrefetch(controller.signal)) break;
        try { await prefetchPublicApplicationExperience(manifest, controller.signal); }
        catch { /* Prefetch is optional. Foreground keeps its own retry/error path. */ }
        if (controller.signal.aborted) break;
      }
    };
    void run();
    return () => controller.abort();
  }, [manifests, enabled, disconnected, metered]);
}
