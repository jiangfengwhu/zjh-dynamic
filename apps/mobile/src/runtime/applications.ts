import { disposeApplicationRooms } from "./applicationRooms";
import { beginApplicationAttempt, clearApplicationAttempt, consumeApplicationInterruption } from "./applicationAttempts";
import { assertApplicationSdkCompatible, ApplicationSdkError } from "./applicationCompatibility";
import NativePluginHost from "../NativePluginHost";
import { downloadApplicationResources, type DownloadPriority } from "./applicationDownloads";
import { afterInteractions, waitForInteractions, waitForRouteTransitions } from "../shell/interactionWork";
import { edgeUrl } from "../shell/evolveHost";
import { readShellValue, readShellValueSync, shellKeys, writeShellValue } from "../shell/shellStorage";
import { accountFetch, currentAccountId, cachedAccountId, subscribeAccountIdentity } from "../shell/account";
import { applicationContext, peekRegisteredApplication, activateApplication, installApplicationAssets, onApplicationPageReady, onApplicationPageAttempt, onApplicationPageMounted, disposeApplication, runApplicationLifecycle } from "../../../../packages/app-sdk/src/runtime";
import { createApplicationModuleScope, releaseApplicationModuleScope } from "./applicationModules";
import { restoreWorks } from "../shell/workRecovery";
import { isWorkDeleted } from "../shell/deletedWorkState";
import { loadCatalog, loadCatalogSync, saveCatalog } from "../shell/catalog";
import type { PendingPackage } from "../shell/packageUpdates";
import type { MarketApplication } from "../shell/market";

import type { ApplicationManifest } from "../../../../packages/app-sdk/src/index";
export type { ApplicationManifest } from "../../../../packages/app-sdk/src/index";

const hostBuildId = (require("../shell/build-identity.json") as { buildId: string }).buildId;
// A package that failed under a previous host may work after a runtime fix.
async function failedUnderCurrentHost(appId: string, releaseId: string) {
  if (await readShellValue(`application.failed.${appId}`) !== releaseId) return false;
  return await readShellValue(`application.failed.host.${appId}`) === hostBuildId;
}
const loading = new Map<string, Promise<void>>();
const loaded = new Set<string>();
const evaluating = new Set<string>();
const quarantined = new Set<string>();
const reloading = new Map<string, Promise<void>>();
const replacementModes = new Map<string, boolean | "failure">();
const active = new Map<string, ApplicationManifest>();
type Access = { releaseId: string; ownerId: string | null; public?: boolean };
class AccessDenied extends Error {}
const healthy = new Set<string>();
onApplicationPageAttempt(appId => { const manifest = active.get(appId); if (manifest && !healthy.has(appId)) beginApplicationAttempt(appId, manifest.releaseId, hostBuildId); });
onApplicationPageReady(appId => { void commitHealthy(appId); });
const offered = new Map<string, { manifest: ApplicationManifest; ownerId: string | null }>();
const activeAccess = new Map<string, Access>();
export type PublicReleaseChange = { manifest: ApplicationManifest };
const publicReleaseListeners = new Set<(replacement: PublicReleaseChange) => void>();
export function subscribePublicApplicationRelease(listener: (replacement: PublicReleaseChange) => void) {
  publicReleaseListeners.add(listener);
  return () => { publicReleaseListeners.delete(listener); };
}
/** Selected public installs survive runtime eviction. Private candidates never enter the feed. */
export function selectedPublicApplicationRelease(appId: string): ApplicationManifest | undefined {
  const entry = loadCatalogSync().find(item => item.id === appId);
  if (!entry || entry.trashedAt || entry.purged) return undefined;
  try {
    const pending = readShellValueSync(`application.pending.${appId}`);
    const manifest = JSON.parse(pending || readShellValueSync(`application.install.${appId}`) || "null") as ApplicationManifest | null;
    const access = JSON.parse(readShellValueSync(`application.${pending ? "pending.access" : "access"}.${appId}`) || "null") as Access | null;
    if (manifest?.appId === appId && access?.releaseId === manifest.releaseId && access.public && !access.ownerId) return manifest;
  } catch { /* Incomplete local selections are not public versions. */ }
}
export function resolvePublicApplicationExperience(item: MarketApplication): MarketApplication {
  const manifest = selectedPublicApplicationRelease(item.manifest.appId);
  return !manifest || manifest.releaseId === item.manifest.releaseId ? item : {
    ...item, manifest, title: manifest.appName, summary: manifest.description,
    iconUrl: undefined, sharing: undefined, latest: true, detailAt: undefined,
  };
}
export function loadedPublicApplicationRelease(appId: string) {
  const access = activeAccess.get(appId);
  return loaded.has(appId) && access?.public && !access.ownerId ? active.get(appId) : undefined;
}
// Keep seven evaluated runtimes, plus pages that are genuinely retained by UI.
// Disk installs are unaffected; evicted apps can evaluate their cached bundle again.
const runtimeWindows = new Map<object, ReadonlySet<string>>();
const mountedPages = new Map<string, number>();
const runtimeUse = new Map<string, number>();
let useSequence = 0;
let trimScheduled = false;
const protectedRuntime = (id: string) => !!mountedPages.get(id)
  || [...runtimeWindows.values()].some(ids => ids.has(id));
function scheduleRuntimeTrim() {
  if (trimScheduled) return;
  trimScheduled = true;
  afterInteractions(() => {
    trimScheduled = false;
    const excess = loaded.size - 7;
    if (excess <= 0) return;
    const candidates = [...loaded].filter(id => !protectedRuntime(id) && !loading.has(id) && !reloading.has(id))
      .sort((a, b) => (runtimeUse.get(a) ?? 0) - (runtimeUse.get(b) ?? 0));
    for (const id of candidates.slice(0, excess)) {
      // Reserve disposal before yielding; a concurrent open waits and reloads.
      const task = Promise.resolve().then(async () => {
        if (protectedRuntime(id) || loading.has(id) || loaded.size <= 7) return;
        await releaseRuntime(id);
      }).finally(() => {
        if (reloading.get(id) === task) { reloading.delete(id); replacementModes.delete(id); }
      });
      reloading.set(id, task); replacementModes.set(id, false);
      void task.catch(() => {});
    }
  });
}
export function retainApplicationRuntimes(owner: object, ids: readonly string[]) {
  runtimeWindows.set(owner, new Set(ids));
  scheduleRuntimeTrim();
  return () => { runtimeWindows.delete(owner); scheduleRuntimeTrim(); };
}
onApplicationPageMounted(id => {
  mountedPages.set(id, (mountedPages.get(id) ?? 0) + 1);
  runtimeUse.set(id, ++useSequence);
  return () => {
    const remaining = (mountedPages.get(id) ?? 1) - 1;
    if (remaining) mountedPages.set(id, remaining); else {
      mountedPages.delete(id);
      const manifest = active.get(id);
      if (manifest && !healthy.has(id) && !evaluating.has(id)) clearApplicationAttempt(id, manifest.releaseId, false);
    }
    scheduleRuntimeTrim();
  };
});
const manifestTexts = new WeakMap<ApplicationManifest, string>();
const marketTexts = new WeakMap<MarketApplication, string>();
function manifestText(manifest: ApplicationManifest) {
  let text = manifestTexts.get(manifest);
  if (!text) { text = JSON.stringify(manifest); manifestTexts.set(manifest, text); }
  return text;
}
function persistChanged(key: string, value: string) {
  if (readShellValueSync(key) !== value) writeShellValue(key, value);
}
subscribeAccountIdentity(id => {
  offered.clear();
  if (id) void restoreWorks(false, true).catch(() => {});
  for (const [appId, access] of activeAccess) if (access.ownerId && access.ownerId !== id) void unloadApplication(appId).catch(() => {});
});
async function verifyCandidateAccess(manifest: ApplicationManifest, ownerId: string): Promise<void> {
  if (await currentAccountId() !== ownerId) throw new AccessDenied("请登录作品所属账号后再体验候选版本");
  const response = await accountFetch(`${edgeUrl}/v1/applications/${manifest.appId}/releases/${manifest.releaseId}`, { headers: { "X-Workshop-Token": await readShellValue(`shell.jules.apps.${manifest.appId}.token`) || "" } }, false);
  if ([401, 403, 404].includes(response.status) || await currentAccountId() !== ownerId) throw new AccessDenied("候选版本的制作权限已失效");
  if (!response.ok) throw new Error("暂时无法核对制作权限，请联网重试");
}
/** Public manifests come from the platform's market/release responses. */
export async function preparePublicApplication(manifest: ApplicationManifest, rememberAccess = true, signal?: AbortSignal) {
  if (isWorkDeleted(manifest.appId)) throw new Error("作品已删除");
  assertCompatible(manifest, manifest.appId);
  await downloadApplicationResources(manifest, signal);
  if (isWorkDeleted(manifest.appId)) throw new Error("作品已删除");
  signal?.throwIfAborted();
  if (rememberAccess) writeShellValue(`application.pending.access.${manifest.appId}`, JSON.stringify({ releaseId: manifest.releaseId, ownerId: null, public: true }));
}

/** Load a public work for the current stage or its bounded warm queue. */
export async function loadPublicApplicationExperience(manifest: ApplicationManifest, signal: AbortSignal, item?: MarketApplication, downloadOnly = false, priority: DownloadPriority = "visible") {
  const appId = manifest.appId;
  if (isWorkDeleted(appId)) throw new Error("作品已删除");
  assertCompatible(manifest, appId);
  signal.throwIfAborted();
  const installerId = cachedAccountId();
  const initialEntry = loadCatalogSync().find(entry => entry.id === appId);
  const checkLocal = () => {
    if (isWorkDeleted(appId)) throw new Error("作品已删除");
    const saved = readShellValueSync(`application.pending.${appId}`) || readShellValueSync(`application.install.${appId}`);
    if (saved && saved !== manifestText(manifest) && !sameApplicationRelease(JSON.parse(saved) as ApplicationManifest, manifest))
      throw new Error("本机保存的版本与当前公开版本不同，请从作品详情管理版本后再体验");
  };
  const persistDownload = async () => {
    const catalog = loadCatalogSync();
    checkLocal();
    const entry = catalog.find(entry => entry.id === appId);
    // A completed background download must not undo a later uninstall.
    if ((entry?.trashedAt && entry.trashedAt !== initialEntry?.trashedAt) || (entry?.purged && !initialEntry?.purged))
      throw new Error("本机安装状态已改变，请重新打开作品");
    const newlyInstalled = !entry || entry.trashedAt || entry.purged;
    const saved = readShellValueSync(`application.install.${appId}`);
    const pending = readShellValueSync(`application.pending.${appId}`);
    // Downloaded first installs remain staged until their page passes the
    // existing health check, just like an explicit install.
    if (!saved && !pending) {
      writeShellValue(`application.pending.access.${appId}`, JSON.stringify({ releaseId: manifest.releaseId, ownerId: null, public: true }));
      persistChanged(`application.pending.${appId}`, manifestText(manifest));
    }
    if (item) {
      let metadata = marketTexts.get(item);
      if (!metadata) { metadata = JSON.stringify(item); marketTexts.set(item, metadata); }
      persistChanged(`application.market.${appId}`, metadata);
    }
    const registry = require("../../../../packages/features/src/registry") as typeof import("../../../../packages/features/src/registry");
    if (!registry.bundles.some(entry => entry.id === appId)) registry.registerApplicationMetadata(manifest);
    if (newlyInstalled) {
      if (entry) Object.assign(entry, { trashedAt: undefined, purged: false, hidden: false, pinned: true });
      else catalog.push({ id: appId, hidden: false, pinned: true });
      await saveCatalog(catalog);
      if (installerId && installerId === cachedAccountId()) void accountFetch(`${edgeUrl}/v1/application-download/${appId}`, {
        method: "POST", body: JSON.stringify({ releaseId: manifest.releaseId }),
      }).catch(() => {});
    }
  };
  const acceptPublicRuntime = async () => {
    if (isWorkDeleted(appId)) throw new Error("作品已删除");
    const running = active.get(appId);
    if (!running || !sameApplicationRelease(running, manifest))
      throw new Error("本机正在使用其他版本，请从作品详情管理版本后再体验");
    // This exact version was supplied by the public market snapshot.
    signal.throwIfAborted();
    if (active.get(appId) !== running || quarantined.has(appId))
      throw new Error("本机应用状态已改变，请重试");
    const publicAccess: Access = { releaseId: manifest.releaseId, ownerId: null, public: true };
    activeAccess.set(appId, publicAccess);
    for (const slot of ["install", "pending"]) {
      const raw = readShellValueSync(`application.${slot}.${appId}`);
      if (!raw) continue;
      let local: ApplicationManifest;
      try { local = JSON.parse(raw); } catch { continue; }
      if (!sameApplicationRelease(local, manifest)) continue;
      // Leave a different/newer workshop candidate and its access untouched.
      const accessKey = `application.${slot === "pending" ? "pending.access" : "access"}.${appId}`;
      const value = JSON.stringify(publicAccess);
      if (readShellValueSync(accessKey) !== value) writeShellValue(accessKey, value);
    }
  };
  if (loading.has(appId) || loaded.has(appId)) {
    await loadApplication(appId);
    signal.throwIfAborted();
    await acceptPublicRuntime();
    await persistDownload();
    return;
  }
  checkLocal();
  signal.throwIfAborted();
  await downloadApplicationResources(manifest, signal, priority);
  // Native downloads finish even if the feed moved away. Keep completed,
  // complete packages installed; cancellation only stops runtime warming.
  await persistDownload();
  if (downloadOnly) return;
  signal.throwIfAborted();
  // Downloads may finish during a gesture. Yield again before staging/evaluating
  // code, and re-check cancellation and local selection after that wait.
  if (priority === "visible") await waitForRouteTransitions(signal);
  else await waitForInteractions(signal);
  signal.throwIfAborted();
  // A workshop/install may have changed the local selection while downloading.
  checkLocal();
  const installedEntry = loadCatalogSync().find(entry => entry.id === appId);
  if (!installedEntry || installedEntry.trashedAt || installedEntry.purged)
    throw new Error("应用已卸载，请重新打开作品");
  signal.throwIfAborted();
  if (loading.has(appId)) {
    await loadApplication(appId);
  } else {
    persistChanged(`application.pending.access.${appId}`, JSON.stringify({ releaseId: manifest.releaseId, ownerId: null, public: true }));
    persistChanged(`application.pending.${appId}`, manifestText(manifest));
    await loadApplication(appId);
  }
  signal.throwIfAborted();
  await acceptPublicRuntime();
}

function sameApplicationRelease(local: ApplicationManifest, published: ApplicationManifest) {
  return local.appId === published.appId && local.releaseId === published.releaseId
    && local.bundle?.sha256 === published.bundle.sha256 && local.source?.commit === published.source.commit;
}

/** Recover verified public downloads made before feed installs were catalogued. */
export async function restoreDownloadedApplications() {
  const catalog = loadCatalogSync();
  const known = new Set(catalog.map(entry => entry.id));
  let changed = false;
  for (const key of shellKeys()) {
    const appId = key.match(/^application\.(?:install|pending)\.([a-z][a-z0-9-]{0,63})$/)?.[1];
    // Tombstones are intentional uninstall records and must stay removed.
    if (!appId || known.has(appId)) continue;
    try {
      const pending = readShellValueSync(`application.pending.${appId}`);
      const manifest = JSON.parse(pending || readShellValueSync(`application.install.${appId}`) || "null") as ApplicationManifest | null;
      const access = JSON.parse(readShellValueSync(`application.${pending ? "pending.access" : "access"}.${appId}`) || "null") as Access | null;
      if (!manifest || !access?.public || access.ownerId || access.releaseId !== manifest.releaseId) continue;
      assertCompatible(manifest, appId);
      if (readShellValueSync(`application.failed.${appId}`) === manifest.releaseId && readShellValueSync(`application.failed.host.${appId}`) === hostBuildId) continue;
      (require("../../../../packages/features/src/registry") as typeof import("../../../../packages/features/src/registry")).registerApplicationMetadata(manifest);
      catalog.push({ id: appId, hidden: false, pinned: true });
      known.add(appId); changed = true;
    } catch { /* Ignore incomplete downloads and invalid local records. */ }
  }
  if (changed) await saveCatalog(catalog);
}
// Generated from the dependency lock at host build time.
const contract = require("./application-contract.json") as { engineAbi: string; sdk: string; shared: Record<string, string> };
const { moduleRangeSize } = require("../../../../packages/app-sdk/platform.json") as { moduleRangeSize: number };

export function runningApplication(appId: string) { return active.get(appId); }
export function applicationLoaded(appId: string) {
  const access = activeAccess.get(appId);
  return loaded.has(appId) && !reloading.has(appId) && !quarantined.has(appId) && !!access && (!access.ownerId || access.ownerId === cachedAccountId());
}
/** Common applications reuse only public runtimes, never workshop candidates. */
export function publicApplicationLoaded(appId: string) {
  const access = activeAccess.get(appId);
  return applicationLoaded(appId) && access?.public === true && !access.ownerId;
}
export function applicationNeedsReload(manifest: ApplicationManifest) {
  return quarantined.has(manifest.appId) || evaluating.has(manifest.appId) && !loaded.has(manifest.appId) || !!active.get(manifest.appId) && active.get(manifest.appId)?.releaseId !== manifest.releaseId;
}
export function runningApplicationReleases() { return Object.fromEntries([...active].filter(([id]) => healthy.has(id)).map(([id, manifest]) => [id, manifest.releaseId])); }
export function offerApplication(manifest: ApplicationManifest, ownerId: string | null = null) { assertCompatible(manifest, manifest.appId); offered.set(manifest.appId, { manifest, ownerId }); }

export type PublicApplicationUpdate = { status: "current" | "update" | "blocked" | "unavailable" | "private"; manifest?: ApplicationManifest; message?: string };
type PublicSnapshot = { key: string; at: number; applications: Array<{ appId: string; manifest: ApplicationManifest | null }> };
let publicSnapshot: PublicSnapshot | undefined;
const publicFlights = new Map<string, Promise<PublicSnapshot>>();
export async function publicApplicationUpdates(force = false): Promise<Record<string, PublicApplicationUpdate>> {
  const catalog = (await loadCatalog()).filter(entry => !entry.trashedAt && !entry.purged);
  const ids = catalog.map(entry => entry.id).sort(); const key = ids.join(",");
  if (!ids.length) return {};
  if (!publicSnapshot) { try { publicSnapshot = JSON.parse(await readShellValue("application.public-updates") || "null") || undefined; } catch {} }
  let snapshot = publicSnapshot;
  if (force || !snapshot || snapshot.key !== key || Date.now() - snapshot.at >= 5 * 60 * 1000) {
    let flight = publicFlights.get(key);
    if (!flight) {
      flight = (async () => {
        const batches = [];
        for (let i = 0; i < ids.length; i += 100) batches.push(ids.slice(i, i + 100));
        const pages = await Promise.all(batches.map(async batch => {
          const response = await fetchApplicationCatalog(`${edgeUrl}/v1/application-updates?ids=${encodeURIComponent(batch.join(","))}`);
          if (!response.ok) throw new Error("暂时无法检查应用更新，请重试");
          const data = await response.json() as Pick<PublicSnapshot, "applications">;
          if (!Array.isArray(data.applications) || batch.some(id => !data.applications.some(item => item.appId === id))) throw new Error("应用更新信息不完整，请重试");
          return data.applications;
        }));
        const value = { key, at: Date.now(), applications: pages.flat() };
        publicSnapshot = value; writeShellValue("application.public-updates", JSON.stringify(value)); return value;
      })();
      publicFlights.set(key, flight);
    }
    try { snapshot = await flight; } finally { if (publicFlights.get(key) === flight) publicFlights.delete(key); }
  }
  const byId = new Map(snapshot!.applications.map(item => [item.appId, item.manifest]));
  const result: Record<string, PublicApplicationUpdate> = {};
  for (const id of ids) {
    const pending = await readShellValue(`application.pending.${id}`);
    const raw = pending || await readShellValue(`application.install.${id}`);
    const access = await readShellValue(`application.${pending ? "pending.access" : "access"}.${id}`);
    try {
      if (JSON.parse(access || "{}").ownerId) { result[id] = { status: "private", message: "体验版本在工坊中更新" }; continue; }
      const manifest = byId.get(id);
      if (!manifest) { result[id] = { status: "unavailable", message: "已撤回，保留本机版本" }; continue; }
      if (raw && JSON.parse(raw).releaseId === manifest.releaseId) { result[id] = { status: "current", manifest }; continue; }
      if (await failedUnderCurrentHost(id, manifest.releaseId)) { result[id] = { status: "blocked", message: "新版加载失败，保留本机版本" }; continue; }
      try { assertCompatible(manifest, id); result[id] = { status: "update", manifest }; }
      catch (error) { result[id] = { status: "blocked", message: error instanceof Error ? error.message : "请先更新平台" }; }
    } catch { result[id] = { status: "blocked", message: "本机版本信息异常，请重新打开详情" }; }
  }
  return result;
}

let updatingPublicApplications: Promise<void> | undefined;
/** Download and replace public applications independently of host/APK updates. */
export function updatePublicApplicationsSilently(): Promise<void> {
  if (updatingPublicApplications) return updatingPublicApplications;
  const task = (async () => {
    await checkApplicationUpdates();
    let stageError: unknown;
    try { await stageApplicationUpdates(); } catch (error) { stageError = error; }
    const ids = [...offered].filter(([appId, offer]) => {
      if (offer.ownerId) return false;
      try {
        const pending = JSON.parse(readShellValueSync(`application.pending.${appId}`) || "null") as ApplicationManifest | null;
        const access = JSON.parse(readShellValueSync(`application.pending.access.${appId}`) || "{}");
        const entry = loadCatalogSync().find(item => item.id === appId);
        return !!entry && !entry.trashedAt && !entry.purged && pending?.releaseId === offer.manifest.releaseId && access.public === true && !access.ownerId && access.releaseId === pending.releaseId;
      } catch { return false; }
    }).map(([id]) => id);
    const results = await Promise.allSettled(ids.map(async appId => {
      // Only mounted pages need replacement execution. Other installs select
      // their prepared version now, and evaluate on the next actual open.
      if (mountedPages.get(appId)) await reloadApplication(appId);
      else {
        if (loaded.has(appId) || loading.has(appId) || quarantined.has(appId)) await unloadApplication(appId);
        const manifest = selectedPublicApplicationRelease(appId);
        if (manifest) publicReleaseListeners.forEach(listener => listener({ manifest }));
      }
    }));
    if (stageError) throw stageError;
    if (results.some(result => result.status === "rejected")) throw new Error("部分应用新版未能加载，保留原有版本");
  })().finally(() => { if (updatingPublicApplications === task) updatingPublicApplications = undefined; });
  updatingPublicApplications = task;
  return task;
}

export async function checkApplicationUpdates(targetAppId?: string): Promise<PendingPackage[]> {
  if (targetAppId) {
    const ownerId = await currentAccountId();
    if (!ownerId || await readShellValue(`shell.jules.apps.${targetAppId}.owner`) !== ownerId) throw new Error("请登录作品所属账号");
    const response = await accountFetch(`${edgeUrl}/v1/applications/${targetAppId}/candidate`, { headers: { "X-Workshop-Token": await readShellValue(`shell.jules.apps.${targetAppId}.token`) || "" } }, false);
    if (!response.ok) throw new Error("暂时无法获取本次作品，请重试");
    const manifest = await response.json() as ApplicationManifest;
    if (await currentAccountId() !== ownerId) throw new Error("账号已改变，请重试");
    offerApplication(manifest, ownerId);
    return active.get(targetAppId)?.releaseId === manifest.releaseId ? [] : [{ id: targetAppId, kind: "application", bytes: manifest.bundle.bytes, sha256: manifest.releaseId }];
  }
  const updates = await publicApplicationUpdates(true);
  // Generic platform updates never consume workshop candidates.
  for (const [appId, item] of offered) if (!item.ownerId) offered.delete(appId);
  for (const item of Object.values(updates)) if (item.status === "update" && item.manifest) offerApplication(item.manifest);
  return Object.entries(updates).filter(([, item]) => item.status === "update").map(([id, item]) => ({ id, kind: "application" as const, bytes: item.manifest!.bundle.bytes, sha256: item.manifest!.releaseId }));
}

export async function stageApplicationUpdates(appId?: string): Promise<number> {
  const catalog = await loadCatalog();
  const installed = new Set(catalog.filter(entry => !entry.trashedAt && !entry.purged).map(entry => entry.id));
  const pending = [...offered.values()].filter(item =>
    (appId ? item.manifest.appId === appId : !item.ownerId && installed.has(item.manifest.appId)) &&
    (active.get(item.manifest.appId)?.releaseId !== item.manifest.releaseId || !!appId && !installed.has(item.manifest.appId))
  );
  const installerId = cachedAccountId();
  const initialSelections = new Map(pending.map(({ manifest }) => [manifest.appId, readShellValueSync(`application.pending.${manifest.appId}`) || readShellValueSync(`application.install.${manifest.appId}`)]));
  const initialStates = new Map(pending.map(({ manifest }) => {
    const entry = catalog.find(entry => entry.id === manifest.appId);
    return [manifest.appId, entry ? { trashedAt: entry.trashedAt, purged: entry.purged } : undefined] as const;
  }));
  const results = await Promise.allSettled(pending.map(async ({ manifest, ownerId }) => {
    if (ownerId) await verifyCandidateAccess(manifest, ownerId);
    await downloadApplicationResources(manifest, undefined, "update");
    if (ownerId) await verifyCandidateAccess(manifest, ownerId);
  }));
  if (installerId !== cachedAccountId()) throw new Error("账号已改变，请重新检查更新");
  const currentCatalog = await loadCatalog();
  let stagedCount = 0;
  for (const [index, { manifest, ownerId }] of pending.entries()) {
    if (isWorkDeleted(manifest.appId)) continue;
    if (results[index].status !== "fulfilled") continue;
    const entry = currentCatalog.find(entry => entry.id === manifest.appId);
    const initial = initialStates.get(manifest.appId);
    if ((initial && !entry) || (entry?.trashedAt && entry.trashedAt !== initial?.trashedAt) || (entry?.purged && !initial?.purged)) continue;
    if (!appId && (!entry || entry.trashedAt || entry.purged)) continue;
    if ((readShellValueSync(`application.pending.${manifest.appId}`) || readShellValueSync(`application.install.${manifest.appId}`)) !== initialSelections.get(manifest.appId)) continue;
    // A newer offer arriving during download supersedes this snapshot.
    const currentOffer = offered.get(manifest.appId);
    if (currentOffer?.manifest.releaseId !== manifest.releaseId || currentOffer.ownerId !== ownerId) continue;
    writeShellValue(`application.pending.access.${manifest.appId}`, JSON.stringify({ releaseId: manifest.releaseId, ownerId, public: !ownerId }));
    writeShellValue(`application.pending.${manifest.appId}`, JSON.stringify(manifest));
    if (!entry) currentCatalog.push({ id: manifest.appId, hidden: false, pinned: true });
    else if (appId && (entry.trashedAt || entry.purged)) {
      entry.trashedAt = undefined;
      entry.purged = false;
      entry.hidden = false;
      entry.pinned = true;
    }
    stagedCount++;
  }
  if (stagedCount) await saveCatalog(currentCatalog);
  const failures = results.filter(result => result.status === "rejected");
  if (failures.length) throw new Error(`${stagedCount ? `已准备 ${stagedCount} 个更新；` : ""}${failures.length} 个作品更新失败，请重试`);
  return stagedCount;
}

export async function applyApplicationUpdate(appId: string): Promise<number> {
  const count = await stageApplicationUpdates(appId);
  if (count) await reloadApplication(appId);
  return count;
}

async function releaseRuntime(appId: string) {
  loaded.delete(appId); healthy.delete(appId); evaluating.delete(appId); quarantined.delete(appId);
  active.delete(appId); activeAccess.delete(appId);
  clearApplicationAttempt(appId);
  runtimeUse.delete(appId);
  disposeApplicationRooms(appId);
  try { await disposeApplication(appId); }
  catch { console.warn("应用卸载回调失败", appId); }
  finally { releaseApplicationModuleScope(appId); }
}
function replaceRuntime(appId: string, reopen: boolean): Promise<void> {
  const existing = reloading.get(appId);
  if (existing && replacementModes.get(appId) === reopen) return existing;
  const task = (async () => {
    await existing?.catch(() => {});
    await loading.get(appId)?.catch(() => {});
    await releaseRuntime(appId);
    if (reopen) await startApplicationLoad(appId);
  })().finally(() => { if (reloading.get(appId) === task) { reloading.delete(appId); replacementModes.delete(appId); } });
  reloading.set(appId, task);
  replacementModes.set(appId, reopen);
  return task;
}
export function reloadApplication(appId: string) { return replaceRuntime(appId, true); }
export function unloadApplication(appId: string) { return replaceRuntime(appId, false); }
export async function loadApplication(appId: string): Promise<void> {
  if (isWorkDeleted(appId)) throw new Error("作品已删除");
  const replacement = reloading.get(appId);
  if (replacement) { await replacement; return startApplicationLoad(appId); }
  return startApplicationLoad(appId);
}
function startApplicationLoad(appId: string): Promise<void> {
  if (isWorkDeleted(appId)) return Promise.reject(new Error("作品已删除"));
  if (quarantined.has(appId)) throw new Error("这个版本加载失败，请等待新版本或重载后安装其他版本");
  const existing = loading.get(appId);
  if (existing || loaded.has(appId)) {
    const access = activeAccess.get(appId);
    if (access?.ownerId && cachedAccountId() !== access.ownerId) return Promise.reject(new AccessDenied("请登录作品所属账号后再体验候选版本"));
    return existing ?? Promise.resolve();
  }
  const pending = load(appId).then(() => {
    if (isWorkDeleted(appId)) return;
    loaded.add(appId);
    runtimeUse.set(appId, ++useSequence);
    activateApplication(appId);
    const manifest = loadedPublicApplicationRelease(appId);
    // Notify even after eviction: a first load in this cache may be an update
    // to a version still held by a mounted or restored discovery snapshot.
    if (manifest) publicReleaseListeners.forEach(listener => listener({ manifest }));
  }).catch(async error => {
    if (evaluating.has(appId)) await recoverApplicationFailure(appId);
    throw error;
  }).finally(() => {
    evaluating.delete(appId);
    if (loading.get(appId) === pending) loading.delete(appId);
    scheduleRuntimeTrim();
  });
  loading.set(appId, pending);
  return pending;
}

async function load(appId: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("应用身份无效");
  const key = `application.install.${appId}`;
  const saved = await readShellValue(key);
  let staged = await readShellValue(`application.pending.${appId}`);
  let manifest: ApplicationManifest;
  if (staged) manifest = JSON.parse(staged) as ApplicationManifest;
  else if (saved) manifest = JSON.parse(saved) as ApplicationManifest;
  else manifest = await firstManifest(appId);
  try { assertCompatible(manifest, appId); } catch (error) {
    if (!saved || staged) throw error;
    // A platform major upgrade can require an application update; retain data and pick a compatible seed/release.
    try { manifest = await firstManifest(appId); } catch (lookupError) {
      if (error instanceof ApplicationSdkError) throw error;
      throw lookupError;
    }
  }
  let access: Access | undefined;
  const accessRaw = await readShellValue(staged ? `application.pending.access.${appId}` : `application.access.${appId}`);
  try { access = accessRaw ? JSON.parse(accessRaw) : undefined; } catch {}
  if (access?.releaseId !== manifest.releaseId) access = undefined;
  // A persisted public install was verified before being accepted. Reuse it
  // offline; update checks select newer public releases separately. Private
  // candidates still require the current owner's authorization each JS session.
  if (!access || access.ownerId || !access.public) {
    try {
      const ownerId = access?.ownerId ?? null;
      if (ownerId) await verifyCandidateAccess(manifest, ownerId);
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
  if (await failedUnderCurrentHost(appId, manifest.releaseId)) throw new Error("这个版本加载失败，请等待新版本或重新选择安装版本");
  if (consumeApplicationInterruption(appId, manifest.releaseId, hostBuildId) >= 3) {
    active.set(appId, manifest);
    await recoverApplicationFailure(appId);
    if (loaded.has(appId)) return;
    throw new Error("这个版本连续三次加载中断，已停止自动重试，请更新应用");
  }
  // Keep first installs pending too, so evaluation and lazy-page failures can roll back.
  if (!saved) { writeShellValue(`application.pending.${appId}`, JSON.stringify(manifest)); writeShellValue(`application.pending.access.${appId}`, JSON.stringify(access)); }
  // Record the last accepted version before executing any new package code.
  if (saved && staged && JSON.parse(saved).releaseId !== manifest.releaseId) {
    writeShellValue(`application.previous.${appId}`, saved);
    writeShellValue(`application.previous.access.${appId}`, await readShellValue(`application.access.${appId}`) || "");
  }
  active.set(appId, manifest);
  beginApplicationAttempt(appId, manifest.releaseId, hostBuildId);
  evaluating.add(appId);
  createApplicationModuleScope(appId, manifest.modules.base, manifest.modules.size);
  const raw = await NativePluginHost.call("shell", "loadApplication", JSON.stringify(manifest));
  const result = JSON.parse(raw) as { assets: Record<string, string> };
  installApplicationAssets(appId, result.assets);
  const definition = peekRegisteredApplication(appId);
  if (!definition) throw new Error(`应用没有登记入口：${appId}`);

  active.set(appId, manifest);
  if (!saved && definition.onInstall) await runApplicationLifecycle(() => definition.onInstall!(applicationContext(appId)), "应用初始化", 10000);
  // Warming a hidden page completed evaluation; only a real mount arms it again.
  clearApplicationAttempt(appId, manifest.releaseId, false);
  console.log("application ready", appId, manifest.releaseId);
}

export function validateApplication(manifest: ApplicationManifest) { assertCompatible(manifest, manifest.appId); }

function assertCompatible(manifest: ApplicationManifest, appId: string) {
  if (manifest.format !== 1 || manifest.appId !== appId || !/^[a-f0-9]{64}$/.test(manifest.releaseId) || !/^[a-f0-9]{64}$/.test(manifest.bundle?.sha256)) throw new Error("应用清单无效");
  const source = manifest.source;
  if (!source || typeof source.dirty !== "boolean" || !/^[a-f0-9]{40}$/.test(source.commit) || ((source.dirty || source.tree !== undefined) && !/^[a-f0-9]{40}$/.test(source.tree ?? ""))) throw new Error("应用源码快照无效，请重新发布");
  assertApplicationSdkCompatible(manifest.sdk, contract.sdk);
  if (!Number.isSafeInteger(manifest.modules.base) || manifest.modules.base < 2000000 || manifest.modules.base % moduleRangeSize || manifest.modules.size !== moduleRangeSize) throw new Error("应用模块范围不匹配");
  for (const other of active.values()) {
    if (other.appId !== appId && other.modules.base === manifest.modules.base) throw new Error(`应用模块范围冲突：${appId} 与 ${other.appId}`);
  }
}

export function reportApplicationFailure(appId: string, releaseId?: string): Promise<void> {
  const current = active.get(appId);
  if (releaseId && current?.releaseId !== releaseId) return Promise.resolve();
  const existing = reloading.get(appId);
  if (existing && replacementModes.get(appId) === "failure") return existing;
  const task = (async () => {
    await existing?.catch(() => {});
    await loading.get(appId)?.catch(() => {});
    if (active.get(appId) === current) await recoverApplicationFailure(appId);
  })().finally(() => { if (reloading.get(appId) === task) { reloading.delete(appId); replacementModes.delete(appId); } });
  reloading.set(appId, task); replacementModes.set(appId, "failure");
  return task;
}
/** Late callbacks may finish after a different release has been selected. */
function clearReleaseSelection(appId: string, releaseId: string) {
  const key = `application.pending.${appId}`;
  try {
    if (JSON.parse(readShellValueSync(key) || "null")?.releaseId === releaseId) {
      writeShellValue(key, "");
      writeShellValue(`application.pending.access.${appId}`, "");
    }
  } catch { /* Leave an unrelated or malformed selection for its own recovery. */ }
  clearApplicationAttempt(appId, releaseId);
}

async function recoverApplicationFailure(appId: string) {
  const current = active.get(appId);
  if (!current) return;
  quarantined.add(appId); active.delete(appId); activeAccess.delete(appId);
  const previous = readShellValueSync(`application.previous.${appId}`);
  const previousAccess = readShellValueSync(`application.previous.access.${appId}`);
  healthy.delete(appId);
  writeShellValue(`application.failed.${appId}`, current.releaseId);
  writeShellValue(`application.failed.host.${appId}`, hostBuildId);
  clearReleaseSelection(appId, current.releaseId);
  if (previous && JSON.parse(previous).releaseId !== current.releaseId) {
    writeShellValue("application.rollback.notice", "新版应用加载失败，已恢复上一个可用版本，本机数据保留。");
    writeShellValue(`application.install.${appId}`, previous);
    writeShellValue(`application.access.${appId}`, previousAccess || "");
    writeShellValue(`application.previous.${appId}`, "");
    await releaseRuntime(appId);
    try { await load(appId); loaded.add(appId); activateApplication(appId); }
    catch { await releaseRuntime(appId); quarantined.add(appId); }
    finally { evaluating.delete(appId); }
  } else {
    writeShellValue(`application.install.${appId}`, "");
    writeShellValue(`application.access.${appId}`, "");
    await releaseRuntime(appId);
  }
}

async function commitHealthy(appId: string) {
  const manifest = active.get(appId); const access = activeAccess.get(appId);
  if (!manifest || !access || healthy.has(appId)) return;
  if (access.ownerId && await currentAccountId() !== access.ownerId) return;
  if (isWorkDeleted(appId) || quarantined.has(appId) || active.get(appId)?.releaseId !== manifest.releaseId) return;
  healthy.add(appId);
  writeShellValue(`application.install.${appId}`, JSON.stringify(manifest));
  writeShellValue(`application.access.${appId}`, JSON.stringify(access));
  clearReleaseSelection(appId, manifest.releaseId);
}

async function firstManifest(appId: string): Promise<ApplicationManifest> {
  const response = await fetchApplicationCatalog(`${edgeUrl}/v1/applications/${appId}/public`);
  if (!response.ok) throw new Error(`应用尚未安装或发布：${appId}`);
  const manifest = await response.json() as ApplicationManifest;
  return manifest;
}

export async function fetchApplicationCatalog(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try { return await fetch(url, { signal: controller.signal }); } finally { clearTimeout(timer); }
}
