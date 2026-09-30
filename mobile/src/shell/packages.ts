import NativePluginHost from "../NativePluginHost";

export type PackageKind = "layer" | "plugin";

export type InstalledPackage = {
  id: string;
  kind: PackageKind;
  bytes: number;
  present: boolean;
};

export async function loadInstalledPackages(): Promise<InstalledPackage[]> {
  const raw = await NativePluginHost.call("shell", "packages", "{}");
  const parsed = JSON.parse(raw) as { ok?: boolean; items?: InstalledPackage[]; error?: string };
  if (!parsed.ok || !Array.isArray(parsed.items)) {
    throw new Error(parsed.error ?? "包信息不可用");
  }
  console.log(
    "packages",
    parsed.items.map((item) => `${item.kind}:${item.id}=${item.bytes}`).join(" "),
  );
  return parsed.items;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
