import { Linking } from "react-native";
import NativePluginHost from "../NativePluginHost";
import { edgeUrl } from "./evolveHost";
import { checkApplicationUpdates, stageApplicationUpdates } from "../runtime/applications";

export type PendingPackage = {
  id: string;
  kind: "layer" | "application" | "apk";
  versionName?: string;
  url?: string;
  bytes: number;
  sha256: string;
};

export async function checkPackageUpdates(): Promise<PendingPackage[]> {
  // 当前 APK 会吞掉下载错误；先确认线上版本，避免把下载失败当作没有更新。
  const identity = require("./build-identity.json") as { buildId: string; apk?: { versionCode: number } };
  // The host can only run under its matching APK runtime contract.
  const response = await fetch(`${edgeUrl}/v1/updates?apkVersionCode=${identity.apk?.versionCode ?? 0}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("暂时无法读取线上版本，请稍后重试");
  const catalog = await response.json() as { release?: { id?: string; source?: { buildId?: string } }; apkUpdate?: boolean; apk?: { versionCode: number; versionName: string; sha256: string; bytes: number; url: string } };
  const release = catalog.release;
  if (!release?.id || !release.source?.buildId) throw new Error("线上版本信息不完整，请稍后重试");
  if (catalog.apkUpdate && catalog.apk) {
    const apk = catalog.apk;
    if (!/^[a-f0-9]{64}$/.test(apk.sha256) || !Number.isSafeInteger(apk.bytes) || apk.bytes <= 0 || apk.url !== `https://zjh-cdn.297782.xyz/v1/apk/${apk.sha256}.apk`) throw new Error("APK 更新清单无效");
    return [{ id: `apk-${apk.versionCode}`, kind: "apk", sha256: apk.sha256, bytes: apk.bytes, url: apk.url, versionName: apk.versionName }];
  }
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
  return [...items, ...await checkApplicationUpdates()];
}

export function updateSignature(items: PendingPackage[]): string {
  return items.map((item) => `${item.kind}:${item.id}:${item.sha256}`).sort().join("|");
}

export async function applyPackageUpdates(items: PendingPackage[] = []): Promise<number> {
  const apk = items.find(item => item.kind === "apk");
  if (apk) {
    if (!apk.url || apk.url !== `https://zjh-cdn.297782.xyz/v1/apk/${apk.sha256}.apk`) throw new Error("APK 下载地址无效");
    await Linking.openURL(apk.url);
    return 0;
  }
  const applicationCount = await stageApplicationUpdates();
  const raw = await NativePluginHost.call("shell", "applyUpdates", "{}");
  const parsed = JSON.parse(raw) as { ok?: boolean; applied?: number; error?: string; message?: string };
  if (parsed.ok === false || !Number.isSafeInteger(parsed.applied) || parsed.applied! < 0) throw new Error(parsed.message || parsed.error || "更新未能应用，请重试");
  console.log("package updates apply", parsed.applied ?? 0);
  if (applicationCount && !parsed.applied) {
    const result = JSON.parse(await NativePluginHost.call("shell", "reloadApplications", "{}")) as { ok?: boolean };
    if (!result.ok) throw new Error("应用已下载，但刷新未完成，请重新打开 App");
  }
  return (parsed.applied ?? 0) + applicationCount;
}
