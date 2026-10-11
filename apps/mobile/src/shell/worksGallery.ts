import { accountFetch, cachedAccountId } from "./account";
import { edgeUrl } from "./evolveHost";
import { cachedPage, rememberPage, pageCacheKey } from "./pageCache";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { readShellValueSync } from "./shellStorage";
import { runningApplicationReleases } from "../runtime/applications";
import type { AuthorProfile } from "./feed/userPosts";
import type { MyWork } from "./works";
import { isWorkDeleted, syncDeletedWorks, deletedWorksRevision } from "./deletedWorks";
export type GalleryPage = {works: MyWork[]; nextCursor: string | null; totalCount: number; summary?: AuthorProfile; at: number};
const summaryListeners = new Set<(summary: AuthorProfile) => void>();
export function subscribeMySummary(listener: (summary: AuthorProfile) => void) { summaryListeners.add(listener); return () => {summaryListeners.delete(listener);}; }
export function cachedMySummary() { return cachedPage<AuthorProfile>(pageCacheKey("my-summary")); }
const flights = new Map<string, Promise<GalleryPage>>();
export function fetchWorksGallery(cursor?: string, query = "", refresh = false) {
  const owner = cachedAccountId();
  const key = pageCacheKey(`works-gallery:${query}:${cursor || ""}`);
  const revision = deletedWorksRevision();
  const flightKey = `${key}:${revision}`;
  const existing = cachedPage<GalleryPage>(key);
  if (!refresh && existing && Date.now() - existing.at < 4000) return Promise.resolve(existing);
  if (flights.has(flightKey)) return flights.get(flightKey)!;
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor); if (query) params.set("q", query); if (refresh) params.set("refresh", "1");
  const operation = (async () => {
    const response = await accountFetch(`${edgeUrl}/v1/me/works?${params}`, {}, false);
    if (!response.ok) throw new Error("暂时无法读取作品，请重试");
    const page = await response.json() as GalleryPage & {deletedAppIds?: string[]};
    if (owner !== cachedAccountId()) throw new Error("账号已切换");
    if (revision !== deletedWorksRevision()) throw new Error("作品列表已变更，请刷新");
    if (owner && page.deletedAppIds?.length) void syncDeletedWorks(owner, page.deletedAppIds).catch(() => {});
    if (owner !== cachedAccountId()) throw new Error("账号已切换");
    page.works = page.works.filter(work => !isWorkDeleted(work.appId));
    page.at = Date.now();
    if (page.summary) { rememberPage(pageCacheKey("my-summary"), page.summary); summaryListeners.forEach(listener => listener(page.summary!)); }
    return rememberPage(key, page);
  })().finally(() => { if (flights.get(flightKey) === operation) flights.delete(flightKey); });
  flights.set(flightKey, operation); return operation;
}
/** Only a locally submitted newer round overrides the cloud list. No cloud
 * recovery credentials or manifest snapshots are scattered into local storage. */
export function projectGallery(works: MyWork[]) {
  const context = applicationContext("jolly");
  const owner = cachedAccountId();
  const releases = runningApplicationReleases();
  return works.filter(work => !isWorkDeleted(work.appId)).map(work => {
    let run: {at?: number; stage?: MyWork["stage"]; wish?: string; status?: string} = {};
    try { run = JSON.parse(context.storage.get(`run:${work.appId}`) || "{}"); } catch {}
    const localOwner = readShellValueSync(`shell.jules.apps.${work.appId}.owner`);
    const newer = localOwner === owner && (run.at || 0) > work.createdAt;
    const result = newer ? {...work, stage: run.stage || "making", wish: run.wish || work.wish, message: run.status || "", createdAt: run.at!} : work;
    return result.stage === "load" && result.manifest && releases[result.appId] === result.manifest.releaseId ? {...result, stage: "ready" as const} : result;
  });
}
