import NativePluginHost from "../NativePluginHost";
import { edgeUrl } from "../shell/evolveHost";
import { readShellValue, writeShellValue } from "../shell/shellStorage";
import { applicationContext, peekRegisteredApplication, activateApplication, installApplicationAssets } from "../../../../packages/app-sdk/src/runtime";
import { loadCatalog, saveCatalog } from "../shell/catalog";
import type { PendingPackage } from "../shell/packageUpdates";

export type ApplicationManifest = {
  format: number; appId: string; releaseId: string; title: string; summary: string; mark: string; accent: string;
  requires: { engineAbi: string; sdk: string; shared: Record<string, string> };
  modules: { base: number; size: number };
  bundle: { sha256: string; bytes: number };
  assets: Array<{ name: string; sha256: string; bytes: number }>;
  source: { commit: string; dirty: boolean };
};

const bootstrap = require("../../../../tools/applications/bootstrap.json");
const loading = new Map<string, Promise<void>>();
const active = new Map<string, ApplicationManifest>();
const offered = new Map<string, ApplicationManifest>();
// Generated from the dependency lock at host build time.
const contract = require("./application-contract.json") as { engineAbi: string; sdk: string; shared: Record<string, string> };
const allocations = require("../../../../tools/applications/allocations.json") as { applications: Record<string, number>; moduleRangeSize: number };

export function runningApplication(appId: string) { return active.get(appId); }
export function applicationNeedsReload(manifest: ApplicationManifest) {
  return loading.has(manifest.appId) && active.get(manifest.appId)?.releaseId !== manifest.releaseId;
}
export function runningApplicationReleases() { return Object.fromEntries([...active].map(([id, manifest]) => [id, manifest.releaseId])); }
export function offerApplication(manifest: ApplicationManifest) { assertCompatible(manifest, manifest.appId); offered.set(manifest.appId, manifest); }

export async function checkApplicationUpdates(): Promise<PendingPackage[]> {
  const marketResponse = await fetchApplicationCatalog(`${edgeUrl}/v1/market`);
  if (!marketResponse.ok) throw new Error("无法检查市场应用更新");
  const market = await marketResponse.json() as { applications: Array<{ manifest: ApplicationManifest }> };
  for (const [appId, current] of active) {
    let manifest = market.applications.find(item => item.manifest.appId === appId)?.manifest;
    if (await readShellValue(`shell.jules.apps.${appId}.token`)) {
      const response = await fetchApplicationCatalog(`${edgeUrl}/v1/applications/${appId}/latest`);
      if (!response.ok) throw new Error(`无法检查应用更新：${appId}`);
      manifest = await response.json() as ApplicationManifest;
    }
    if (manifest && manifest.releaseId !== current.releaseId && manifest.releaseId !== await readShellValue(`application.failed.${appId}`)) offerApplication(manifest);
  }
  return [...offered.values()].filter(manifest => active.get(manifest.appId)?.releaseId !== manifest.releaseId).map(manifest => ({ id: manifest.appId, kind: "application", bytes: manifest.bundle.bytes, sha256: manifest.releaseId }));
}

export async function stageApplicationUpdates(): Promise<number> {
  const pending = [...offered.values()].filter(manifest => active.get(manifest.appId)?.releaseId !== manifest.releaseId);
  for (const manifest of pending) {
    await NativePluginHost.call("shell", "prepareApplication", JSON.stringify(manifest));
  }
  const catalog = await loadCatalog();
  for (const manifest of pending) {
    writeShellValue(`application.pending.${manifest.appId}`, JSON.stringify(manifest));
    if (!catalog.some(entry => entry.id === manifest.appId)) catalog.push({ id: manifest.appId, hidden: false, pinned: true });
  }
  if (pending.length) await saveCatalog(catalog);
  return pending.length;
}

export async function loadApplication(appId: string): Promise<void> {
  const existing = loading.get(appId);
  if (existing) return existing;
  const pending = load(appId);
  loading.set(appId, pending);
  // A failed evaluation may have registered modules. Retry requires a fresh JS environment.
  return pending;
}

async function load(appId: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("应用身份无效");
  const key = `application.install.${appId}`;
  const saved = await readShellValue(key);
  let staged = await readShellValue(`application.pending.${appId}`);
  if (staged && await readShellValue(`application.attempt.${appId}`)) {
    writeShellValue(`application.failed.${appId}`, JSON.parse(staged).releaseId);
    writeShellValue(`application.pending.${appId}`, "");
    writeShellValue(`application.attempt.${appId}`, "");
    staged = undefined;
  }
  let manifest: ApplicationManifest;
  if (staged) manifest = JSON.parse(staged) as ApplicationManifest;
  else if (saved) manifest = JSON.parse(saved) as ApplicationManifest;
  else manifest = await firstManifest(appId);
  // The default companion is shipped alongside the host SDK API.
  if (!staged && appId === bootstrap.defaultApplication && manifest.requires.sdk !== contract.sdk) manifest = await firstManifest(appId);
  try { assertCompatible(manifest, appId); } catch (error) {
    if (!saved || staged) throw error;
    // An APK upgrade can change the ABI; retain data and pick a compatible seed/release.
    manifest = await firstManifest(appId);
  }
  assertCompatible(manifest, appId);
  console.log("application load", appId, manifest.releaseId);
  if (staged) writeShellValue(`application.attempt.${appId}`, manifest.releaseId);
  const raw = await NativePluginHost.call("shell", "loadApplication", JSON.stringify(manifest));
  const result = JSON.parse(raw) as { assets: Record<string, string> };
  installApplicationAssets(appId, result.assets);
  const definition = peekRegisteredApplication(appId);
  if (!definition) throw new Error(`应用没有登记入口：${appId}`);

  active.set(appId, manifest);
  activateApplication(appId);
  if (!saved && definition.onInstall) await definition.onInstall(applicationContext(appId));
  if (saved && staged) writeShellValue(`application.previous.${appId}`, saved);
  writeShellValue(key, JSON.stringify(manifest));
  writeShellValue(`application.pending.${appId}`, "");
  writeShellValue(`application.attempt.${appId}`, "");
  console.log("application ready", appId, manifest.releaseId);
}

export function validateApplication(manifest: ApplicationManifest) { assertCompatible(manifest, manifest.appId); }

function assertCompatible(manifest: ApplicationManifest, appId: string) {
  if (manifest.format !== 1 || manifest.appId !== appId || !/^[a-f0-9]{64}$/.test(manifest.releaseId) || !/^[a-f0-9]{64}$/.test(manifest.bundle?.sha256) || manifest.source.dirty) throw new Error("应用清单无效");
  if (manifest.requires.engineAbi !== contract.engineAbi || !sdkCompatible(manifest.requires.sdk, contract.sdk)) throw new Error(`应用需要不同的平台版本：${appId}`);
  for (const [name, version] of Object.entries(manifest.requires.shared)) {
    if (contract.shared[name] !== version) throw new Error(`应用依赖不兼容：${name} 需要 ${version}，当前为 ${contract.shared[name] ?? "未提供"}`);
  }
  if (allocations.applications[appId] !== undefined && allocations.applications[appId] !== manifest.modules.base) throw new Error("已分配应用的模块范围不可变更");
  if (!Number.isSafeInteger(manifest.modules.base) || manifest.modules.base < 2000000 || manifest.modules.base % allocations.moduleRangeSize || manifest.modules.size !== allocations.moduleRangeSize) throw new Error("应用模块范围不匹配");
  for (const other of active.values()) {
    if (other.appId !== appId && other.modules.base === manifest.modules.base) throw new Error(`应用模块范围冲突：${appId} 与 ${other.appId}`);
  }
}

function sdkCompatible(required: string, available: string) {
  const parse = (value: string) => /^\d+\.\d+\.\d+$/.test(value) ? value.split(".").map(Number) : undefined;
  const a = parse(required), b = parse(available);
  return !!a && !!b && a[0] === b[0] && (b[1] > a[1] || (b[1] === a[1] && b[2] >= a[2]));
}

export async function reportApplicationFailure(appId: string) {
  const current = active.get(appId);
  if (!current) return;
  const previous = await readShellValue(`application.previous.${appId}`);
  if (previous) {
    writeShellValue(`application.failed.${appId}`, current.releaseId);
    writeShellValue(`application.install.${appId}`, previous);
  }
}

async function firstManifest(appId: string): Promise<ApplicationManifest> {
  const seed = JSON.parse(await NativePluginHost.call("shell", "applicationSeed", JSON.stringify({ appId }))) as { manifest?: ApplicationManifest };
  if (seed.manifest && (appId !== bootstrap.defaultApplication || seed.manifest.requires.sdk === contract.sdk)) {
    try { assertCompatible(seed.manifest, appId); return seed.manifest; } catch { /* Need a newer compatible release. */ }
  }
  const response = await fetchApplicationCatalog(`${edgeUrl}/v1/applications/${appId}/latest`);
  if (!response.ok) throw new Error(`应用尚未安装或发布：${appId}`);
  return response.json();
}

export async function fetchApplicationCatalog(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try { return await fetch(url, { signal: controller.signal }); } finally { clearTimeout(timer); }
}
