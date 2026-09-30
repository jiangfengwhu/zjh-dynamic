import NativePluginHost from "../NativePluginHost";

export type PendingPackage = {
  id: string;
  kind: "layer";
  bytes: number;
  sha256: string;
};

const WATCH_MS = 30 * 60 * 1000;
let watchTimer: ReturnType<typeof setInterval> | undefined;

export function startReleaseWatch(onCheck: () => void) {
  if (watchTimer) return;
  watchTimer = setInterval(() => {
    console.log("release watch tick");
    onCheck();
  }, WATCH_MS);
  console.log("release watch every", WATCH_MS);
}

export async function checkPackageUpdates(): Promise<PendingPackage[]> {
  const raw = await NativePluginHost.call(
    "shell",
    "checkUpdates",
    "{}",
  );
  const parsed = JSON.parse(raw) as { items?: PendingPackage[] };
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  console.log("package updates", items.map((item) => `${item.kind}:${item.id}`).join(" ") || "none");
  return items;
}

export function updateSignature(items: PendingPackage[]): string {
  return items.map((item) => `${item.kind}:${item.id}:${item.sha256}`).sort().join("|");
}

export async function applyPackageUpdates(): Promise<number> {
  const raw = await NativePluginHost.call("shell", "applyUpdates", "{}");
  const parsed = JSON.parse(raw) as { applied?: number };
  console.log("package updates apply", parsed.applied ?? 0);
  return parsed.applied ?? 0;
}
