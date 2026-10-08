import { currentAccountId } from "./account";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { cachedSharing, installedMarket, type MarketApplication, type SharingState } from "./market";
import { readShellValue, readShellValueSync } from "./shellStorage";
import { hydrateWorksCache, type Work } from "./workRecovery";
import { runningApplicationReleases } from "../runtime/applications";

export type WorkStage = "draft" | "making" | "reply" | "load" | "ready" | "paused" | "failed" | "blocked";
export type MyWork = { appId: string; title: string; wish: string; stage: WorkStage; message: string; manifest?: MarketApplication["manifest"]; sharing?: SharingState; stale?: boolean; createdAt: number };
export const workLabels: Record<WorkStage, string> = { draft: "尚未开始", making: "制作中", reply: "等待回复", load: "待体验", ready: "可使用", paused: "已暂停", failed: "制作未完成", blocked: "需要处理" };
function parsed<T>(raw?: string): T | undefined { try { return raw ? JSON.parse(raw) : undefined; } catch { return undefined; } }
export async function readMyWorks(knownInstalled?: MarketApplication[]): Promise<MyWork[]> {
  const accountId = await currentAccountId();
  if (!accountId) return [];
  await hydrateWorksCache();
  if (await currentAccountId() !== accountId) return [];
  const context = applicationContext("jolly");
  let workspaces = parsed<Array<{ appId: string; title: string }>>(context.storage.get("workspaces")) ?? [];
  workspaces = (await Promise.all(workspaces.map(async workspace => { const owner = await readShellValue(`shell.jules.apps.${workspace.appId}.owner`); return owner && owner !== accountId ? undefined : workspace; }))).filter((workspace): workspace is { appId: string; title: string } => Boolean(workspace));
  const installed = knownInstalled ?? await installedMarket();
  const snapshot = parsed<{ works: Work[] }>(readShellValueSync(`shell.works.cache.${accountId}`));
  const snapshots = new Map((snapshot?.works ?? []).filter(work => work.ownerId === accountId).map(work => [work.appId, work]));
  for (const item of installed.filter(item => item.owned)) if (!workspaces.some(work => work.appId === item.manifest.appId)) workspaces.push({ appId: item.manifest.appId, title: item.manifest.appName });
  const result = await Promise.all(workspaces.map(async workspace => {
    const run = parsed<{ wish?: string; status?: string; stage?: WorkStage; at?: number }>(context.storage.get(`run:${workspace.appId}`));
    const cached = snapshots.get(workspace.appId);
    // A newly submitted local round takes precedence over an older server snapshot.
    if (cached && (!run?.at || (cached.startedAt ?? 0) >= run.at)) {
      const status = cached.status, manifest = status?.application ?? cached.sharing?.application ?? undefined;
      if (!manifest && !cached.session?.startsWith("sessions/")) return undefined;
      let stage: WorkStage = status?.state === "FAILED" ? "failed" : status?.state === "PAUSED" ? "paused" : status?.state === "AWAITING_USER_FEEDBACK" ? "reply" : status?.completed ? manifest ? "load" : status.delivery === "blocked" ? "blocked" : "making" : "making";
      if (status?.stale && run?.stage) stage = run.stage;
      if (stage === "load" && manifest && runningApplicationReleases()[workspace.appId] === manifest.releaseId) stage = "ready";
      return { appId: cached.appId, title: manifest?.appName || cached.title || "未命名作品", wish: cached.wish, stage, message: status?.message ?? "", manifest, sharing: cached.sharing, stale: status?.stale, createdAt: cached.startedAt ?? 0 };
    }
    const sharing = await cachedSharing(workspace.appId);
    const manifest = parsed<MarketApplication["manifest"]>(await readShellValue(`shell.workshop.application.${workspace.appId}`)) ?? installed.find(item => item.manifest.appId === workspace.appId)?.manifest ?? sharing?.application ?? undefined;
    const title = manifest?.appName || workspace.title;
    const summary = parsed<{ stale: boolean }>(await readShellValue(`shell.work.summary.${accountId}.${workspace.appId}`));
    let stage: WorkStage = run?.stage && Object.hasOwn(workLabels, run.stage) ? run.stage : manifest ? "ready" : "draft";
    if (stage === "load" && manifest && runningApplicationReleases()[workspace.appId] === manifest.releaseId) stage = "ready";
    const session = await readShellValue(`shell.jules.apps.${workspace.appId}.session`);
    if (!manifest && !session?.startsWith("sessions/")) return undefined;
    return { appId: workspace.appId, title: title && title !== workspace.appId ? title : "未命名作品", wish: run?.wish ?? "", stage, message: run?.status ?? "", manifest, sharing, stale: summary?.stale, createdAt: run?.at ?? 0 };
  }));
  return result.filter((work): work is NonNullable<typeof work> => !!work).sort((a, b) => b.createdAt - a.createdAt || b.appId.localeCompare(a.appId));
}
