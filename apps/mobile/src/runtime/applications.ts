import NativePluginHost from "../NativePluginHost";
import { edgeUrl } from "../shell/evolveHost";
import { readShellValue, writeShellValue } from "../shell/shellStorage";
import { accountFetch, currentAccountId, subscribeAccountIdentity } from "../shell/account";
import { applicationContext, peekRegisteredApplication, activateApplication, installApplicationAssets, onApplicationPageReady, onApplicationPageAttempt } from "../../../../packages/app-sdk/src/runtime";
import { restoreWorks } from "../shell/workRecovery";
import { confirmCreation } from "../shell/creationConsent";
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
const evaluating = new Set<string>();
const quarantined = new Set<string>();
const active = new Map<string, ApplicationManifest>();
type Access = { releaseId: string; ownerId: string | null; public?: boolean };
class AccessDenied extends Error {}
const healthy = new Set<string>();
onApplicationPageAttempt(appId => { const manifest = active.get(appId); if (manifest && !healthy.has(appId)) writeShellValue(`application.attempt.${appId}`, manifest.releaseId); });
onApplicationPageReady(appId => { void commitHealthy(appId); });
const offered = new Map<string, { manifest: ApplicationManifest; ownerId: string | null }>();
const activeAccess = new Map<string, Access>();
subscribeAccountIdentity(id => {
  offered.clear();
  if (id) void restoreWorks(true).catch(() => {});
  if ([...activeAccess.values()].some(access => access.ownerId && access.ownerId !== id)) void NativePluginHost.call("shell", "reloadApplications", "{}").catch(() => {});
});
async function verifyAccess(manifest: ApplicationManifest, ownerId: string | null): Promise<void> {
  if (ownerId) {
    if (await currentAccountId() !== ownerId) throw new AccessDenied("请登录作品所属账号后再体验候选版本");
    const response = await accountFetch(`${edgeUrl}/v1/applications/${manifest.appId}/releases/${manifest.releaseId}`, { headers: { "X-Workshop-Token": await readShellValue(`shell.jules.apps.${manifest.appId}.token`) || "" } }, false);
    if ([401, 403, 404].includes(response.status) || await currentAccountId() !== ownerId) throw new AccessDenied("候选版本的制作权限已失效");
    if (!response.ok) throw new Error("暂时无法核对制作权限，请联网重试");
  } else {
    const response = await fetchApplicationCatalog(`${edgeUrl}/v1/applications/${manifest.appId}/releases/${manifest.releaseId}`);
    if ([401, 403, 404].includes(response.status)) throw new AccessDenied("这个版本尚未公开发布");
    if (!response.ok) throw new Error("暂时无法核对执行版本，请联网重试");
    const published = await response.json();
    if (published.releaseId !== manifest.releaseId || published.bundle.sha256 !== manifest.bundle.sha256 || published.source.commit !== manifest.source.commit) throw new AccessDenied("这个版本尚未公开发布");
  }
}
export async function preparePublicApplication(manifest: ApplicationManifest) {
  const published = await fetchApplicationCatalog(`${edgeUrl}/v1/applications/${manifest.appId}/public`);
  if (!published.ok || (await published.json()).releaseId !== manifest.releaseId) throw new Error("公开版本已改变，请刷新应用市场");
  assertCompatible(manifest, manifest.appId); await verifyAccess(manifest, null);
  await NativePluginHost.call("shell", "prepareApplication", JSON.stringify(manifest));
  await verifyAccess(manifest, null);
  writeShellValue(`application.pending.access.${manifest.appId}`, JSON.stringify({ releaseId: manifest.releaseId, ownerId: null, public: true }));
}
// Generated from the dependency lock at host build time.
const contract = require("./application-contract.json") as { engineAbi: string; sdk: string; shared: Record<string, string> };
const allocations = require("../../../../tools/applications/allocations.json") as { applications: Record<string, number>; moduleRangeSize: number };

export function runningApplication(appId: string) { return active.get(appId); }
export function applicationNeedsReload(manifest: ApplicationManifest) {
  return loading.has(manifest.appId) && active.get(manifest.appId)?.releaseId !== manifest.releaseId;
}
export function runningApplicationReleases() { return Object.fromEntries([...active].filter(([id]) => healthy.has(id)).map(([id, manifest]) => [id, manifest.releaseId])); }
export function offerApplication(manifest: ApplicationManifest, ownerId: string | null = null) { assertCompatible(manifest, manifest.appId); offered.set(manifest.appId, { manifest, ownerId }); }

export async function checkApplicationUpdates(): Promise<PendingPackage[]> {
  const marketResponse = await fetchApplicationCatalog(`${edgeUrl}/v1/market`);
  if (!marketResponse.ok) throw new Error("无法检查市场应用更新");
  const market = await marketResponse.json() as { applications: Array<{ manifest: ApplicationManifest }> };
  const accountId = await currentAccountId();
  // Workshop offers include first installs, which are absent from active and market.
  // Refresh public updates without discarding the current author's private candidates.
  for (const [appId, item] of offered) {
    if (!item.ownerId || item.ownerId !== accountId || item.manifest.releaseId === await readShellValue(`application.failed.${appId}`)) offered.delete(appId);
  }
  for (const [appId, current] of active) {
    let manifest = market.applications.find(item => item.manifest.appId === appId)?.manifest;
    let ownerId: string | null = null;
    if (accountId && await readShellValue(`shell.jules.apps.${appId}.owner`) === accountId) {
      const response = await accountFetch(`${edgeUrl}/v1/applications/${appId}/candidate`, { headers: { "X-Workshop-Token": await readShellValue(`shell.jules.apps.${appId}.token`) || "" } }, false);
      if (!response.ok) throw new Error(`无法检查应用更新：${appId}`);
      manifest = await response.json() as ApplicationManifest;
      if (await currentAccountId() !== accountId) continue;
      ownerId = accountId;
    }
    if (manifest && manifest.releaseId !== current.releaseId && manifest.releaseId !== await readShellValue(`application.failed.${appId}`)) offerApplication(manifest, ownerId);
  }
  return [...offered.values()].map(item => item.manifest).filter(manifest => active.get(manifest.appId)?.releaseId !== manifest.releaseId).map(manifest => ({ id: manifest.appId, kind: "application", bytes: manifest.bundle.bytes, sha256: manifest.releaseId }));
}

export async function stageApplicationUpdates(): Promise<number> {
  const pending = [...offered.values()].filter(item => active.get(item.manifest.appId)?.releaseId !== item.manifest.releaseId);
  for (const { manifest, ownerId } of pending) {
    if (ownerId) await confirmCreation("体验候选版本", manifest.appId, "加载本轮制作的候选版本，体验后可决定是否收下。");
    await verifyAccess(manifest, ownerId);
    await NativePluginHost.call("shell", "prepareApplication", JSON.stringify(manifest));
  }
  const catalog = await loadCatalog();
  for (const { manifest, ownerId } of pending) {
    await verifyAccess(manifest, ownerId);
    writeShellValue(`application.pending.access.${manifest.appId}`, JSON.stringify({ releaseId: manifest.releaseId, ownerId, public: !ownerId }));
    writeShellValue(`application.pending.${manifest.appId}`, JSON.stringify(manifest));
    if (!catalog.some(entry => entry.id === manifest.appId)) catalog.push({ id: manifest.appId, hidden: false, pinned: true });
  }
  if (pending.length) await saveCatalog(catalog);
  return pending.length;
}

export async function loadApplication(appId: string): Promise<void> {
  if (quarantined.has(appId)) throw new Error("这个版本加载失败，请等待新版本或重载后安装其他版本");
  const existing = loading.get(appId);
  if (existing) return existing;
  const pending = load(appId).catch(error => { if (!evaluating.has(appId)) loading.delete(appId); throw error; });
  loading.set(appId, pending);
  // A failed evaluation may have registered modules. Retry requires a fresh JS environment.
  return pending;
}

async function load(appId: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("应用身份无效");
  const key = `application.install.${appId}`;
  const saved = await readShellValue(key);
  let staged = await readShellValue(`application.pending.${appId}`);
  if (staged && (await readShellValue(`application.attempt.${appId}`) || await readShellValue(`application.evaluation.${appId}`))) {
    writeShellValue(`application.failed.${appId}`, JSON.parse(staged).releaseId);
    writeShellValue(`application.pending.${appId}`, "");
    writeShellValue(`application.attempt.${appId}`, "");
    writeShellValue(`application.evaluation.${appId}`, "");
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
  let access: Access | undefined;
  const accessRaw = await readShellValue(staged ? `application.pending.access.${appId}` : `application.access.${appId}`);
  try { access = accessRaw ? JSON.parse(accessRaw) : undefined; } catch {}
  if (access?.releaseId !== manifest.releaseId) access = undefined;
  if (!access || access.ownerId || !access.public || !staged) {
    try {
      const ownerId = access?.ownerId ?? null;
      await verifyAccess(manifest, ownerId);
      access = { releaseId: manifest.releaseId, ownerId, public: !ownerId };
    } catch (error) {
      if (!(error instanceof AccessDenied)) { if (!access?.public || access.ownerId) throw error; }
      else {
        writeShellValue(`application.pending.${appId}`, ""); staged = undefined;
        manifest = await firstManifest(appId);
        access = { releaseId: manifest.releaseId, ownerId: null, public: true };
      }
    }
  }
  if (!access) throw new Error("无法确定应用执行权限，请重试");
  assertCompatible(manifest, appId);
  if (access.ownerId && await currentAccountId() !== access.ownerId) throw new Error("作品账号已改变，请重载");
  activeAccess.set(appId, access);
  console.log("application load", appId, manifest.releaseId);
  if (manifest.releaseId === await readShellValue(`application.failed.${appId}`)) throw new Error("这个版本加载失败，请等待新版本或重新选择安装版本");
  // Keep first installs pending too, so evaluation and lazy-page failures can roll back.
  if (!saved) { writeShellValue(`application.pending.${appId}`, JSON.stringify(manifest)); writeShellValue(`application.pending.access.${appId}`, JSON.stringify(access)); }
  writeShellValue(`application.evaluation.${appId}`, manifest.releaseId);
  evaluating.add(appId);
  const raw = await NativePluginHost.call("shell", "loadApplication", JSON.stringify(manifest));
  const result = JSON.parse(raw) as { assets: Record<string, string> };
  installApplicationAssets(appId, result.assets);
  const definition = peekRegisteredApplication(appId);
  if (!definition) throw new Error(`应用没有登记入口：${appId}`);

  active.set(appId, manifest);
  activateApplication(appId);
  if (!saved && definition.onInstall) await definition.onInstall(applicationContext(appId));
  if (saved && staged) {
    writeShellValue(`application.previous.${appId}`, saved);
    writeShellValue(`application.previous.access.${appId}`, await readShellValue(`application.access.${appId}`) || "");
  }
  writeShellValue(`application.evaluation.${appId}`, "");
  if (saved && JSON.parse(saved).releaseId === manifest.releaseId) { healthy.add(appId); }
  if (appId === bootstrap.defaultApplication) await restoreWorks().catch(() => {});
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
  quarantined.add(appId); active.delete(appId); activeAccess.delete(appId);
  const previous = await readShellValue(`application.previous.${appId}`);
  healthy.delete(appId);
  writeShellValue(`application.failed.${appId}`, current.releaseId);
  writeShellValue(`application.pending.${appId}`, "");
  writeShellValue(`application.attempt.${appId}`, "");
  writeShellValue(`application.evaluation.${appId}`, "");
  if (previous && JSON.parse(previous).releaseId !== current.releaseId) {
    writeShellValue(`application.install.${appId}`, previous);
    writeShellValue(`application.access.${appId}`, await readShellValue(`application.previous.access.${appId}`) || "");
    writeShellValue(`application.previous.${appId}`, "");
    await NativePluginHost.call("shell", "reloadApplications", "{}");
  } else {
    writeShellValue(`application.install.${appId}`, "");
    writeShellValue(`application.access.${appId}`, "");
    await NativePluginHost.call("shell", "reloadApplications", "{}");
  }
}

async function commitHealthy(appId: string) {
  const manifest = active.get(appId); const access = activeAccess.get(appId);
  if (!manifest || !access || healthy.has(appId)) return;
  if (access.ownerId && await currentAccountId() !== access.ownerId) return;
  if (quarantined.has(appId) || active.get(appId)?.releaseId !== manifest.releaseId) return;
  healthy.add(appId);
  writeShellValue(`application.install.${appId}`, JSON.stringify(manifest));
  writeShellValue(`application.access.${appId}`, JSON.stringify(access));
  writeShellValue(`application.pending.${appId}`, "");
  writeShellValue(`application.attempt.${appId}`, "");
}

async function firstManifest(appId: string): Promise<ApplicationManifest> {
  const seed = JSON.parse(await NativePluginHost.call("shell", "applicationSeed", JSON.stringify({ appId }))) as { manifest?: ApplicationManifest };
  if (seed.manifest && (appId !== bootstrap.defaultApplication || seed.manifest.requires.sdk === contract.sdk)) {
    try { assertCompatible(seed.manifest, appId); writeShellValue(`application.access.${appId}`, JSON.stringify({ releaseId: seed.manifest.releaseId, ownerId: null, public: true })); return seed.manifest; } catch { /* Need a newer compatible release. */ }
  }
  const response = await fetchApplicationCatalog(`${edgeUrl}/v1/applications/${appId}/public`);
  if (!response.ok) throw new Error(`应用尚未安装或发布：${appId}`);
  const manifest = await response.json() as ApplicationManifest;
  await verifyAccess(manifest, null);
  return manifest;
}

export async function fetchApplicationCatalog(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try { return await fetch(url, { signal: controller.signal }); } finally { clearTimeout(timer); }
}
