/** SDK majors must match, and the host version must cover the application's SDK package version. */
export function sdkVersion(value: string): number[] | undefined {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return;
  const version = value.split(".").map(Number);
  return version.every(Number.isSafeInteger) ? version : undefined;
}
export function sdkCompatibility(required: string, available: string): "compatible" | "update-application" | "update-platform" | "invalid" {
  const a = sdkVersion(required), b = sdkVersion(available);
  if (!a || !b) return "invalid";
  if (a[0] < b[0]) return "update-application";
  if (a[0] > b[0] || a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])) return "update-platform";
  return "compatible";
}
export function assertSdkCompatible(required: string, available: string) {
  const status = sdkCompatibility(required, available);
  if (status === "compatible") return;
  if (status === "update-application") throw new Error(`应用使用 SDK ${required}，当前平台为 ${available}，请更新应用以适配新版 SDK`);
  if (status === "update-platform") throw new Error(`应用使用 SDK ${required}，当前宿主 SDK 为 ${available}，请更新生花`);
  throw new Error("SDK 版本无效");
}
