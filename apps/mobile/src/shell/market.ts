import { fetchApplicationCatalog, runningApplication, loadApplication, validateApplication, applicationNeedsReload, type ApplicationManifest } from "../runtime/applications";
import { edgeUrl } from "./evolveHost";
import { loadCatalog, saveCatalog } from "./catalog";
import { readShellValue, writeShellValue } from "./shellStorage";
import { registerApplicationMetadata, bundles } from "../../../../packages/features/src/registry";
import NativePluginHost from "../NativePluginHost";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { writePackageValue } from "../../../../packages/ui/packageLink";
export type MarketApplication = { manifest: ApplicationManifest & { version?: string }; authorId: null; authorName: string; originalAppId: string | null; title?: string; summary?: string; owned?: boolean; latest?: boolean };
const CACHE = "market.catalog.v1";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
export async function cachedMarket(): Promise<MarketApplication[]> {
  try { const raw = await readShellValue(CACHE); return raw ? (JSON.parse(raw) as MarketApplication[]).map(item => ({ ...item, latest: false })) : []; } catch { return []; }
}
export async function fetchMarket(): Promise<MarketApplication[]> {
  const response = await fetchApplicationCatalog(`${edgeUrl}/v1/market`);
  if (!response.ok) throw new Error("暂时无法获取应用市场，请稍后重试");
  const data = await response.json() as { applications: MarketApplication[] };
  if (!Array.isArray(data.applications)) throw new Error("应用市场数据暂时不可用");
  const items = data.applications.filter(item => /^[a-z][a-z0-9-]{0,63}$/.test(item.manifest?.appId)).map(item => ({ ...item, latest: true }));
  writeShellValue(CACHE, JSON.stringify(items));
  return items;
}
export async function installedMarket(): Promise<MarketApplication[]> {
  const entries = await loadCatalog();
  const items: MarketApplication[] = [];
  for (const entry of entries.filter(entry => !entry.trashedAt && !entry.purged)) {
    const raw = await readShellValue(`application.pending.${entry.id}`) || await readShellValue(`application.install.${entry.id}`);
    if (!raw) continue;
    try { items.push({ manifest: JSON.parse(raw), authorId: null, authorName: "社区创作者", originalAppId: null, owned: Boolean(await readShellValue(`shell.jules.apps.${entry.id}.token`)) }); } catch { /* Keep other applications available. */ }
  }
  return items;
}
export async function installMarketApplication(item: MarketApplication) {
  const manifest = item.manifest;
  // Compatibility is checked before downloading or changing the installed catalog.
  validateApplication(manifest);
  await NativePluginHost.call("shell", "prepareApplication", JSON.stringify(manifest));
  writeShellValue(`application.pending.${manifest.appId}`, JSON.stringify(manifest));
  writeShellValue(`application.failed.${manifest.appId}`, "");
  writeShellValue(`application.attempt.${manifest.appId}`, "");
  registerApplicationMetadata(manifest);
  const catalog = await loadCatalog();
  const existing = catalog.find(entry => entry.id === manifest.appId);
  if (existing) { existing.trashedAt = undefined; existing.purged = false; existing.hidden = false; existing.pinned = true; }
  else catalog.push({ id: manifest.appId, hidden: false, pinned: true });
  await saveCatalog(catalog);
  const current = runningApplication(manifest.appId);
  if (applicationNeedsReload(manifest)) {
    await NativePluginHost.call("shell", "reloadApplications", "{}");
    return;
  }
  if (current?.releaseId === manifest.releaseId) writeShellValue(`application.pending.${manifest.appId}`, "");
  await loadApplication(manifest.appId);
  // Refresh the avatar after activation, without changing application business code.
  await saveCatalog(await loadCatalog());
}
export async function uninstallMarketApplication(appId: string) {
  if (appId === bootstrap.defaultApplication) throw new Error("Jolly 是默认伙伴，暂不支持卸载");
  const catalog = await loadCatalog();
  const entry = catalog.find(entry => entry.id === appId);
  if (!entry) return;
  entry.trashedAt = Date.now(); entry.hidden = true; entry.pinned = false;
  await saveCatalog(catalog);
  writeShellValue(`application.pending.${appId}`, "");
  // Retain storage and cached media; reload to release evaluated JS and timers.
  await NativePluginHost.call("shell", "reloadApplications", "{}");
}
export function marketDefinition(item: MarketApplication) { return bundles.find(bundle => bundle.id === item.manifest.appId); }

export type SharingState = { shared: MarketApplication | null; accepted: { releaseId: string; commit: string } | null; application: MarketApplication["manifest"] | null };
export async function cachedSharing(appId: string): Promise<SharingState | undefined> {
  const raw = await readShellValue(`shell.market.state.${appId}`);
  try { return raw ? JSON.parse(raw) : undefined; } catch { return undefined; }
}
async function marketAction(appId: string, input: { action: string; releaseId?: string; title?: string; summary?: string }): Promise<SharingState> {
  const token = await readShellValue(`shell.jules.apps.${appId}.token`);
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${edgeUrl}/v1/market`, { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appId, token, ...input }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "分享操作未完成，请重试");
    const state = result as SharingState;
    writeShellValue(`shell.market.state.${appId}`, JSON.stringify(state));
    writeShellValue(`shell.workshop.accepted.${appId}`, state.accepted ? JSON.stringify(state.accepted) : "");
    applicationContext(bootstrap.defaultApplication).storage.set(`sharing.${appId}`, JSON.stringify({ releaseId: state.shared?.manifest.releaseId ?? "", hasUpdate: Boolean(state.shared && state.accepted && state.shared.manifest.releaseId !== state.accepted.releaseId) }));
    if (input.action !== "status") {
      const items = (await cachedMarket()).filter(item => item.manifest.appId !== appId);
      if (state.shared) items.unshift(state.shared);
      writeShellValue(CACHE, JSON.stringify(items));
      writePackageValue("shell.market.changed", String(Date.now()));
    }
    return state;
  } finally { clearTimeout(timer); }
}
export const loadSharing = (appId: string) => marketAction(appId, { action: "status" });
export const shareMarketApplication = (appId: string, releaseId: string, title: string, summary: string) => marketAction(appId, { action: "share", releaseId, title, summary });
export const editMarketApplication = (appId: string, title: string, summary: string) => marketAction(appId, { action: "edit", title, summary });
export const withdrawMarketApplication = (appId: string) => marketAction(appId, { action: "withdraw" });
