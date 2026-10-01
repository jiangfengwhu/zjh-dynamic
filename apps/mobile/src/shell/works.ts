import { currentAccountId } from "./account";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { creationService, type WorkshopStatus } from "./cloudEvolve";
import { cachedSharing, installedMarket, loadSharing, type MarketApplication, type SharingState } from "./market";
import { readShellValue } from "./shellStorage";
import { restoreWorks } from "./workRecovery";

export type WorkStage = "draft" | "making" | "reply" | "load" | "accept" | "accepted" | "paused" | "failed" | "blocked";
export type MyWork = { appId: string; title: string; wish: string; stage: WorkStage; message: string; manifest?: MarketApplication["manifest"]; sharing?: SharingState; stale?: boolean };
export const workLabels: Record<WorkStage, string> = { draft: "尚未开始", making: "制作中", reply: "等待回复", load: "待体验", accept: "待收下", accepted: "已收下", paused: "已暂停", failed: "制作未完成", blocked: "需要处理" };
export const workActions: Record<WorkStage, string> = { draft: "开始制作", making: "查看进度", reply: "回复 Jolly", load: "加载并体验", accept: "体验并收下", accepted: "管理分享", paused: "继续制作", failed: "继续处理", blocked: "处理交付" };
function parsed<T>(raw?: string): T | undefined { try { return raw ? JSON.parse(raw) : undefined; } catch { return undefined; } }
export async function readMyWorks(): Promise<MyWork[]> {
  const accountId = await currentAccountId();
  if (!accountId) return [];
  await restoreWorks().catch(() => {});
  if (await currentAccountId() !== accountId) return [];
  const context = applicationContext("jolly");
  let workspaces = parsed<Array<{ appId: string; title: string }>>(context.storage.get("workspaces")) ?? [];
  workspaces = (await Promise.all(workspaces.map(async workspace => { const owner = await readShellValue(`shell.jules.apps.${workspace.appId}.owner`); return owner && owner !== accountId ? undefined : workspace; }))).filter((workspace): workspace is { appId: string; title: string } => Boolean(workspace));
  const installed = await installedMarket();
  for (const item of installed.filter(item => item.owned)) if (!workspaces.some(work => work.appId === item.manifest.appId)) workspaces.push({ appId: item.manifest.appId, title: item.manifest.title });
  return Promise.all(workspaces.map(async workspace => {
    const run = parsed<{ wish?: string; status?: string; stage?: WorkStage }>(context.storage.get(`run:${workspace.appId}`));
    const sharing = await cachedSharing(workspace.appId);
    const manifest = parsed<MarketApplication["manifest"]>(await readShellValue(`shell.workshop.application.${workspace.appId}`)) ?? installed.find(item => item.manifest.appId === workspace.appId)?.manifest ?? sharing?.application ?? undefined;
    const title = manifest?.title || workspace.title;
    const stage: WorkStage = run?.stage ?? (sharing?.accepted ? "accepted" : "draft");
    return { appId: workspace.appId, title: title && title !== workspace.appId ? title : "未命名作品", wish: run?.wish ?? "", stage, message: run?.status ?? "", manifest, sharing };
  }));
}
export function stageFromWorkshop(status: WorkshopStatus): WorkStage {
  if (status.merged) return "accepted";
  if (status.state === "FAILED") return "failed";
  if (status.state === "PAUSED") return "paused";
  if (status.state === "AWAITING_USER_FEEDBACK") return "reply";
  if (!status.completed) return "making";
  if (status.delivery === "loaded") return "accept";
  if (status.delivery === "update") return "load";
  return "blocked";
}
export async function refreshMyWork(work: MyWork): Promise<MyWork> {
  if (!await readShellValue(`shell.jules.apps.${work.appId}.token`)) return work;
  let next = work;
  try {
    const sharing = await loadSharing(work.appId);
    next = { ...work, sharing, manifest: work.manifest ?? sharing.application ?? undefined };
    const service = creationService(work.appId);
    const session = await service.loadJulesSession();
    if (!session) return { ...next, stale: true, message: "制作记录暂未接回，请进入工坊处理" };
    const status = await service.workshopStatus(session);
    const manifest = status.application ?? next.manifest;
    const context = applicationContext("jolly");
    const run = parsed<Record<string, unknown>>(context.storage.get(`run:${work.appId}`)) ?? {};
    const stage = stageFromWorkshop(status);
    const phase = stage === "accepted" || stage === "load" || stage === "accept" || stage === "blocked" ? "ready" : stage === "failed" ? "failed" : stage === "paused" ? "stopped" : "making";
    context.storage.set(`run:${work.appId}`, JSON.stringify({ ...run, stage, phase, wish: work.wish, status: status.message ?? work.message, steps: run.steps ?? [], at: Date.now() }));
    return { ...next, manifest, title: manifest?.title && manifest.title !== work.appId ? manifest.title : work.title, stage: stageFromWorkshop(status), message: status.message ?? "" };
  } catch { return { ...next, stale: true }; }
}
export function sharingLabel(work: MyWork): string {
  if (work.sharing?.reviewRejected) return "市场审核未通过，请处理后提交新版本";
  if (work.sharing?.reviewPending) return work.sharing.shared ? "已分享 · 新版本审核中" : "市场审核中";
  if (!work.sharing?.shared) return "未分享";
  return work.sharing.accepted?.releaseId !== work.sharing.shared.manifest.releaseId ? "已分享 · 有新版本待分享" : "已分享";
}
