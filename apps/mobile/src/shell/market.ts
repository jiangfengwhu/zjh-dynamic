import { authorFollowRevision, rememberAuthorFollowing, type UserPost } from "./feed/userPosts";
import { afterInteractions, waitForRouteTransitions } from "./interactionWork";
import { cachedPage, rememberPage, pageCacheKey } from "./pageCache";
import { accountFetch, currentAccountId, cachedAccountId } from "./account";
import {
  fetchApplicationCatalog,
  runningApplication,
  loadApplication,
  preparePublicApplication,
  validateApplication,
  applicationNeedsReload,
  reloadApplication,
  unloadApplication,
  type ApplicationManifest,
} from "../runtime/applications";
import { edgeUrl } from "./evolveHost";
import { loadCatalog, saveCatalog } from "./catalog";
import {
  readShellValue,
  readShellValueSync,
  writeShellValue,
  removeShellValue,
  shellKeys,
} from "./shellStorage";
import {
  registerApplicationMetadata,
} from "../../../../packages/features/src/registry";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { shell } from "../../../../packages/platform/src/phone";
import { writePackageValue } from "../../../../packages/ui/packageLink";
import { confirmCreation } from "./creationConsent";
export type MarketApplication = {
  summaryOnly?: boolean;
  discussion?: UserPost;
  interactionOwner?: string;
  interactionAt?: number;
  authorFollowing?: boolean;
  detailAt?: number;
  detailOwner?: string;
  downloadCount?: number;
  iconUrl?: string;
  manifest: ApplicationManifest & { version?: string };
  authorId: string | null;
  authorName: string;
  authorAvatarUrl?: string | null;
  authorOfficial?: boolean;
  originalAppId: string | null;
  title?: string;
  summary?: string;
  category?: string;
  screenshots?: string[];
  publishedAt?: number;
  owned?: boolean;
  latest?: boolean;
  sharing?: SharingState;
};
export const marketCategories = [
  { id: "", label: "全部" },
  { id: "tools", label: "工具" },
  { id: "productivity", label: "效率" },
  { id: "life", label: "生活" },
  { id: "creative", label: "创意" },
  { id: "other", label: "其他" },
];
export const marketDiscoveryCategories = [
  marketCategories[0],
  { id: "official", label: "官方" },
  ...marketCategories.slice(1),
];
export type MarketPage = {
  applications: MarketApplication[];
  nextCursor?: string;
};
export type MarketView = MarketPage & { at: number; offset: number };
const views = new Map<string, MarketView>();
export function cachedMarketView(key: string): MarketView | undefined {
  if (views.has(key)) return views.get(key);
  try { const value = cachedPage<MarketView>(`public:market-view:${key}`); if (Array.isArray(value?.applications)) { const view = { ...value, at: value.at || 1 }; views.set(key, view); return view; } } catch {}
  return undefined;
}
export const marketViewKey = (category: string, query: string) =>
  `${category}:${query.trim().toLowerCase()}`;
const viewWrites = new Map<string, () => void>();
export function rememberMarketView(key: string, view: MarketView, persist = true) {
  views.set(key, view);
  if (!persist) return;
  viewWrites.get(key)?.();
  const cancel = afterInteractions(() => {
    viewWrites.delete(key);
    if (views.get(key) !== view) return;
    rememberPage(`public:market-view:${key}`, view);
    while (views.size > 12) { const oldest = views.keys().next().value!; views.delete(oldest); }
    // Retire the former unbounded, monolithic search snapshots.
    for (const stored of shellKeys()) if (stored.startsWith("market.view.")) removeShellValue(stored);
  });
  viewWrites.set(key, cancel);
}
export async function readMarketView(key: string): Promise<MarketView | undefined> {
  return cachedMarketView(key);
}
export function invalidateMarketViews() {
  views.clear();
  for (const cancel of viewWrites.values()) cancel();
  viewWrites.clear();
}
export async function fetchMarketPicker(cursor?: string, query = ""): Promise<MarketPage> {
  const params = new URLSearchParams({view: "picker", limit: "24", q: query});
  if (cursor) params.set("cursor", cursor);
  const response = await fetch(`${edgeUrl}/v1/market?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("应用列表暂时不可用");
  return response.json();
}
export async function fetchMarketPage(
  category = "",
  query = "",
  cursor?: string,
  discovery = false
): Promise<MarketPage> {
  const params = new URLSearchParams({ limit: "24" });
  if (!discovery) params.set("view", "summary");
  else params.set("social", "0");
  if (category) params.set("category", category);
  if (query.trim()) params.set("q", query.trim());
  if (cursor) params.set("cursor", cursor);
  const owner = cachedAccountId() ?? "guest";
  const revision = authorFollowRevision();
  const response = discovery
    ? await (owner === "guest" ? fetch(`${edgeUrl}/v1/discovery?${params}`, { signal: AbortSignal.timeout(15000) }) : accountFetch(`${edgeUrl}/v1/discovery?${params}`, { signal: AbortSignal.timeout(15000) }, false))
    : await fetchApplicationCatalog(`${edgeUrl}/v1/market?${params}`);
  if (!response.ok) throw new Error("作品加载失败，请重试");
  const data = (await response.json()) as MarketPage;
  if (!Array.isArray(data.applications)) throw new Error("作品数据暂时不可用");
  if (discovery && owner !== (cachedAccountId() ?? "guest")) throw new Error("账号已切换，请重试");
  for (const item of data.applications) if (discovery && item.authorId && item.authorFollowing !== undefined) rememberAuthorFollowing(item.authorId, item.authorFollowing, revision);
  return {
    applications: data.applications
      .filter((item) => item.manifest.appId !== "jolly")
      .map((item) => ({ ...item, latest: true, ...(discovery && item.discussion ? {interactionOwner: owner, interactionAt: Date.now()} : {}) })),
    nextCursor: data.nextCursor,
  };
}
export async function fetchDiscoveryInteractions(pageRequest: Promise<MarketPage>, signal: AbortSignal, cursor?: string): Promise<MarketApplication[]> {
  const owner = cachedAccountId() ?? "guest", revision = authorFollowRevision();
  const interactionAt = Date.now();
  const params = new URLSearchParams({ limit: "24", social: "only" });
  if (cursor) params.set("cursor", cursor);
  const url = `${edgeUrl}/v1/discovery?${params}`;
  const options = { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) };
  const response = owner === "guest" ? await fetch(url, options) : await accountFetch(url, options, false);
  if (!response.ok) throw new Error("互动信息加载失败");
  const { items } = await response.json() as { items: Array<{ appId: string; post: UserPost; following: boolean }> };
  if (owner !== (cachedAccountId() ?? "guest")) throw new Error("账号已切换");
  const byId = new Map(items.map(item => [item.appId, item]));
  const { applications } = await pageRequest;
  return applications.map(item => {
    const info = byId.get(item.manifest.appId);
    if (item.authorId && info) rememberAuthorFollowing(item.authorId, info.following, revision);
    return info ? { ...item, discussion: info.post, authorFollowing: info.following, interactionOwner: owner, interactionAt } : item;
  });
}
const CACHE = "market.catalog.v1";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
export async function fetchPublicMarketApplication(
  appId: string
): Promise<MarketApplication> {
  const response = await fetchApplicationCatalog(
    `${edgeUrl}/v1/market?appId=${encodeURIComponent(appId)}`
  );
  if (!response.ok) throw new Error("应用详情暂时不可用，请重试");
  const data = (await response.json()) as {
    applications?: MarketApplication[];
  };
  const item = data.applications?.find(
    (item) => item.manifest?.appId === appId
  );
  if (!item) throw new Error("这个应用已撤回或暂未公开");
  const next = { ...item, latest: true };
  rememberPage(pageCacheKey(`market:${appId}`), next);
  return next;
}
/** Account-aware detail BFF; no workshop token is needed for a read. */
export async function fetchMarketDetail(appId: string, options?: { signal?: AbortSignal; immediate?: boolean }): Promise<MarketApplication> {
  const owner = await currentAccountId();
  const url = `${edgeUrl}/v1/market?appId=${encodeURIComponent(appId)}&detail=1`;
  const request = { signal: options?.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) };
  const response = owner ? await accountFetch(url, request, false) : await fetch(url, request);
  const result = await response.json() as { item?: MarketApplication; message?: string };
  if (!response.ok || !result.item) throw new Error(result.message || "作品详情暂时不可用");
  if (await currentAccountId() !== owner) throw new Error("账号已改变，请重试");
  if (!options?.immediate) await waitForRouteTransitions(options?.signal);
  options?.signal?.throwIfAborted();
  if (await currentAccountId() !== owner) throw new Error("账号已改变，请重试");
  return rememberPage(pageCacheKey(`market-detail:${appId}`), { ...result.item, latest: true, detailAt: Date.now(), detailOwner: owner ?? "guest" });
}
export async function cachedMarket(): Promise<MarketApplication[]> {
  try {
    const raw = await readShellValue(CACHE);
    return raw
      ? (JSON.parse(raw) as MarketApplication[]).map((item) => ({
          ...item,
          latest: false,
        }))
      : [];
  } catch {
    return [];
  }
}
export async function fetchMarket(
  authorId?: string
): Promise<MarketApplication[]> {
  const response = await fetchApplicationCatalog(
    `${edgeUrl}/v1/market${
      authorId ? `?authorId=${encodeURIComponent(authorId)}` : ""
    }`
  );
  if (!response.ok) throw new Error("暂时无法获取公开作品，请稍后重试");
  const data = (await response.json()) as { applications: MarketApplication[] };
  if (!Array.isArray(data.applications))
    throw new Error("公开作品数据暂时不可用");
  const items = data.applications
    .filter((item) => item.manifest?.appId !== "jolly")
    .filter((item) => /^[a-z][a-z0-9-]{0,63}$/.test(item.manifest?.appId))
    .map((item) => ({ ...item, latest: true }));
  if (!authorId) writeShellValue(CACHE, JSON.stringify(items));
  return items;
}
export function isApplicationInstalledSync(appId: string): boolean {
  try {
    const entries = JSON.parse(readShellValueSync("shell.bundles.v1") || "{}").entries ?? [];
    if (!entries.some((entry: { id: string; trashedAt?: number; purged?: boolean }) => entry.id === appId && !entry.trashedAt && !entry.purged)) return false;
    const pending = readShellValueSync(`application.pending.${appId}`);
    if (!pending && !readShellValueSync(`application.install.${appId}`)) return false;
    const access = JSON.parse(readShellValueSync(`application.${pending ? "pending.access" : "access"}.${appId}`) || "{}");
    return !access.ownerId || access.ownerId === cachedAccountId();
  } catch { return false; }
}
/** Reuse the locally selected public package without a catalog network request. */
export function isPublicApplicationInstalledSync(appId: string): boolean {
  if (!isApplicationInstalledSync(appId)) return false;
  try {
    const pending = readShellValueSync(`application.pending.${appId}`);
    const manifest = JSON.parse(pending || readShellValueSync(`application.install.${appId}`) || "null") as ApplicationManifest | null;
    const access = JSON.parse(readShellValueSync(`application.${pending ? "pending.access" : "access"}.${appId}`) || "{}");
    return manifest?.appId === appId && access.releaseId === manifest.releaseId && access.public === true && !access.ownerId;
  } catch { return false; }
}
export async function isApplicationInstalled(appId: string): Promise<boolean> {
  const owner = await currentAccountId();
  const entries = await loadCatalog();
  if (
    !entries.some(
      (entry) => entry.id === appId && !entry.trashedAt && !entry.purged
    )
  )
    return false;
  const pending = await readShellValue(`application.pending.${appId}`);
  const manifest =
    pending || (await readShellValue(`application.install.${appId}`));
  if (!manifest) return false;
  const raw = await readShellValue(
    `application.${pending ? "pending.access" : "access"}.${appId}`
  );
  try {
    const access = JSON.parse(raw || "{}");
    return (
      (!access.ownerId || access.ownerId === owner) &&
      (await currentAccountId()) === owner
    );
  } catch {
    return false;
  }
}
export async function installedMarket(): Promise<MarketApplication[]> {
  const entries = await loadCatalog();
  const items: MarketApplication[] = [];
  const accountId = await currentAccountId();
  const market = await cachedMarket();
  const byId = new Map(market.map(item => [item.manifest.appId, item]));
  for (const entry of entries.filter(
    (entry) => !entry.trashedAt && !entry.purged
  )) {
    const accessRaw = (readShellValueSync(`application.pending.${entry.id}`))
      ? readShellValueSync(`application.pending.access.${entry.id}`)
      : readShellValueSync(`application.access.${entry.id}`);
    try {
      const access = JSON.parse(accessRaw || "{}");
      if (access.ownerId && access.ownerId !== accountId) continue;
    } catch {
      continue;
    }
    const raw =
      (readShellValueSync(`application.pending.${entry.id}`)) ||
      (readShellValueSync(`application.install.${entry.id}`));
    if (!raw) continue;
    try {
      const saved = readShellValueSync(`application.market.${entry.id}`);
      const author =
        byId.get(entry.id) ??
        (saved ? (JSON.parse(saved) as MarketApplication) : undefined);
      const owned =
        Boolean(accountId) &&
        (readShellValueSync(`shell.jules.apps.${entry.id}.owner`)) ===
          accountId;
      const manifest = JSON.parse(raw) as ApplicationManifest;
      const sharing = owned ? cachedSharingSync(entry.id) : undefined;
      const iconManifest = [sharing?.application, sharing?.shared?.manifest, author?.manifest].find(item => item?.releaseId === manifest.releaseId && item.icon);
      items.push({
        ...author,
        manifest: { ...manifest, icon: manifest.icon ?? iconManifest?.icon },
        iconUrl: sharing?.iconUrl || sharing?.shared?.iconUrl || author?.iconUrl,
        authorId: owned ? accountId! : author?.authorId ?? null,
        authorName: author?.authorName ?? "社区创作者",
        originalAppId: author?.originalAppId ?? null,
        latest: false,
        owned,
      });
    } catch {
      /* Keep other applications available. */
    }
  }
  return (await currentAccountId()) === accountId ? items : [];
}
export async function installMarketApplication(
  item: MarketApplication,
  options?: { reloadLoaded?: boolean; signal?: AbortSignal }
) {
  const manifest = item.manifest;
  const installerId = cachedAccountId();
  // Compatibility is checked before downloading or changing the installed catalog.
  validateApplication(manifest);
  await preparePublicApplication(manifest, false, options?.signal);
  if (installerId !== cachedAccountId()) throw new Error("账号已改变，请重试");
  writeShellValue(`application.pending.access.${manifest.appId}`, JSON.stringify({ releaseId: manifest.releaseId, ownerId: null, public: true }));
  writeShellValue(`application.market.${manifest.appId}`, JSON.stringify(item));
  writeShellValue(
    `application.pending.${manifest.appId}`,
    JSON.stringify(manifest)
  );
  writeShellValue(`application.failed.${manifest.appId}`, "");
  writeShellValue(`application.attempt.${manifest.appId}`, "");
  registerApplicationMetadata(manifest);
  const catalog = await loadCatalog();
  const existing = catalog.find((entry) => entry.id === manifest.appId);
  if (existing) {
    existing.trashedAt = undefined;
    existing.purged = false;
    existing.hidden = false;
    existing.pinned = true;
  } else catalog.push({ id: manifest.appId, hidden: false, pinned: true });
  await saveCatalog(catalog);
  if (installerId && installerId === cachedAccountId()) {
    void accountFetch(`${edgeUrl}/v1/application-download/${manifest.appId}`, {
      method: "POST", body: JSON.stringify({ releaseId: manifest.releaseId }),
    }).catch(() => {});
  }
  const current = runningApplication(manifest.appId);
  if (applicationNeedsReload(manifest)) {
    if (options?.reloadLoaded === false) return "pending" as const;
    await reloadApplication(manifest.appId);
    await saveCatalog(await loadCatalog());
    return "ready" as const;
  }
  if (current?.releaseId === manifest.releaseId)
    writeShellValue(`application.pending.${manifest.appId}`, "");
  await waitForRouteTransitions(options?.signal);
  await loadApplication(manifest.appId);
  // Refresh the avatar after activation, without changing application business code.
  await saveCatalog(await loadCatalog());
  return "ready" as const;
}
export async function uninstallMarketApplication(appId: string) {
  if (appId === bootstrap.defaultApplication)
    throw new Error("Jolly 是默认伙伴，暂不支持卸载");
  const catalog = await loadCatalog();
  const entry = catalog.find((entry) => entry.id === appId);
  if (!entry) return;
  entry.trashedAt = Date.now();
  entry.hidden = true;
  entry.pinned = false;
  await saveCatalog(catalog);
  writeShellValue(`application.pending.${appId}`, "");
  await shell("cancelAllSchedules", { appId }).catch(() => {});
  await shell("removeApplicationShortcuts", { appId }).catch(() => {});
  await shell("removeApplicationWidgets", { appId }).catch(() => {});
  await unloadApplication(appId);
}
export type SharingState = {
  iconUrl?: string;
  shared: MarketApplication | null;
  application: MarketApplication["manifest"] | null;
};
export function cachedSharingSync(appId: string): SharingState | undefined {
  try { return JSON.parse(readShellValueSync(`shell.market.state.${appId}`) || "null") ?? undefined; } catch { return undefined; }
}
export async function cachedSharing(
  appId: string
): Promise<SharingState | undefined> {
  const raw = await readShellValue(`shell.market.state.${appId}`);
  try {
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}
async function marketAction(
  appId: string,
  input: {
    action: string;
    releaseId?: string;
    title?: string;
    summary?: string;
    category?: string;
    screenshots?: string[];
  }
): Promise<SharingState> {
  if (input.action === "withdraw")
    await confirmCreation(
      input.action === "withdraw"
        ? "撤回分享"
        : input.action === "edit"
        ? "修改作品介绍"
        : "公开作品",
      appId,
      input.action === "withdraw"
        ? "作品将不再公开展示；已安装版本和你的作品仍保留。"
        : [input.title, input.summary].filter(Boolean).join("\n")
    );
  const token = await readShellValue(`shell.jules.apps.${appId}.token`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await accountFetch(
      `${edgeUrl}/v1/market`,
      {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId, token, ...input }),
      },
      input.action !== "status"
    );
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.message || "分享操作未完成，请重试");
    const state = result as SharingState;
    writeShellValue(`shell.market.state.${appId}`, JSON.stringify(state));
    applicationContext(bootstrap.defaultApplication).storage.set(
      `sharing.${appId}`,
      JSON.stringify({
        releaseId: state.shared?.manifest.releaseId ?? "",
        hasUpdate: Boolean(
          state.shared &&
            state.application &&
            state.shared.manifest.releaseId !== state.application.releaseId
        ),
      })
    );
    if (input.action !== "status") {
      invalidateMarketViews();
      const items = (await cachedMarket()).filter(
        (item) => item.manifest.appId !== appId
      );
      if (state.shared) items.unshift(state.shared);
      writeShellValue(CACHE, JSON.stringify(items));
      writePackageValue("shell.market.changed", String(Date.now()));
    }
    return state;
  } finally {
    clearTimeout(timer);
  }
}
export const shareMarketApplication = (
  appId: string,
  releaseId: string,
  title: string,
  summary: string,
  category?: string,
  screenshots?: string[]
) =>
  marketAction(appId, {
    action: "share",
    releaseId,
    title,
    summary,
    category,
    screenshots,
  });
export const editMarketApplication = (
  appId: string,
  title: string,
  summary: string,
  category?: string,
  screenshots?: string[]
) =>
  marketAction(appId, {
    action: "edit",
    title,
    summary,
    category,
    screenshots,
  });
export const withdrawMarketApplication = (appId: string) =>
  marketAction(appId, { action: "withdraw" });
