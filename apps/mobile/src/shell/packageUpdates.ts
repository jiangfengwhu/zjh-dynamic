import NativePluginHost from "../NativePluginHost";
import { edgeUrl } from "./evolveHost";

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
  // 当前 APK 会吞掉下载错误；先确认线上版本，避免把下载失败当作没有更新。
  const response = await fetch(`${edgeUrl}/v1/release`);
  if (!response.ok) throw new Error("暂时无法读取线上版本，请稍后重试");
  const release = await response.json() as { id?: string; source?: { buildId?: string } };
  if (!release.id || !release.source?.buildId) throw new Error("线上版本信息不完整，请稍后重试");
  const raw = await NativePluginHost.call(
    "shell",
    "checkUpdates",
    "{}",
  );
  const parsed = JSON.parse(raw) as { ok?: boolean; items?: PendingPackage[]; error?: string; message?: string };
  if (parsed.ok === false || !Array.isArray(parsed.items)) {
    throw new Error(parsed.message || parsed.error || "更新检查未完成，请稍后重试");
  }
  const items = parsed.items;
  const { buildId } = require("./build-identity.json") as { buildId: string };
  if (!items.length && release.source.buildId !== buildId) {
    throw new Error("新包尚未下载完成或无法加载，请稍后重新检查");
  }
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
