import { fetchApplicationCatalog, runningApplication, loadApplication, validateApplication, applicationNeedsReload, type ApplicationManifest } from "../runtime/applications";
import { edgeUrl } from "./evolveHost";
import { loadCatalog, saveCatalog } from "./catalog";
import { readShellValue, writeShellValue } from "./shellStorage";
import { registerApplicationMetadata, bundles } from "../../../../packages/features/src/registry";
import NativePluginHost from "../NativePluginHost";
export type MarketApplication = { manifest: ApplicationManifest & { version?: string }; authorId: null; authorName: string; originalAppId: string | null; latest?: boolean };
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
    try { items.push({ manifest: JSON.parse(raw), authorId: null, authorName: "社区创作者", originalAppId: null }); } catch { /* Keep other applications available. */ }
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
