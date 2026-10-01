import { accountFetch, currentAccountId } from "./account";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { readShellValue, writeShellValue } from "./shellStorage";
import { edgeUrl } from "./evolveHost";

type Work = { appId: string; ownerId: string; session: string; approvalToken: string; title: string; wish: string; startedAt?: number; phase: string; originalAppId?: string; originalReleaseId?: string; };
const restoring = new Map<string, Promise<void>>();
const refreshed = new Map<string, number>();
const hydrated = new Set<string>();
export async function hydrateWorksCache(): Promise<void> {
  const owner = await currentAccountId(); if (!owner || hydrated.has(owner)) return;
  try { const cached = JSON.parse(await readShellValue(`shell.works.cache.${owner}`) || "null"); if (cached) { await applyWorks(owner, cached.works); hydrated.add(owner); } } catch {}
}
export async function restoreWorks(force = false): Promise<void> {
  const owner = await currentAccountId(); if (!owner) return;
  let cached: { at: number; works: Work[] } | undefined;
  try { cached = JSON.parse(await readShellValue(`shell.works.cache.${owner}`) || "null") ?? undefined; } catch {}
  await hydrateWorksCache();
  if (!force && Date.now() - (refreshed.get(owner) ?? cached?.at ?? 0) < 30000) return;
  const prior = restoring.get(owner); if (prior) { if (force) await prior; return; }
  const pending = restore(owner).then(() => { refreshed.set(owner, Date.now()); }).finally(() => restoring.delete(owner));
  restoring.set(owner, pending);
  if (force || !cached) await pending; else void pending.catch(() => {});
}
async function restore(owner: string) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await accountFetch(`${edgeUrl}/v1/works`, { signal: controller.signal }, false);
    if (!response.ok) throw new Error("暂时无法接回作品，请稍后重试");
    const { works } = await response.json() as { works: Work[] };
    if (await currentAccountId() !== owner) return;
    writeShellValue(`shell.works.cache.${owner}`, JSON.stringify({ at: Date.now(), works }));
    await applyWorks(owner, works);
  } finally { clearTimeout(timer); }
}

async function applyWorks(owner: string, works: Work[]) {
  if (await currentAccountId() !== owner || !Array.isArray(works)) return;
    const context = applicationContext("jolly");
    let workspaces: Array<{ appId: string; title: string; originalAppId?: string; originalReleaseId?: string }> = [];
    try { workspaces = JSON.parse(context.storage.get("workspaces") || "[]"); } catch {}
    for (const work of works) {
      if (work.ownerId !== owner || !/^[a-z][a-z0-9-]{0,63}$/.test(work.appId)) continue;
      writeShellValue(`shell.jules.apps.${work.appId}.owner`, owner);
      writeShellValue(`shell.jules.apps.${work.appId}.token`, work.approvalToken);
      if (work.session) writeShellValue(`shell.jules.apps.${work.appId}.session`, work.session);
      const item = { appId: work.appId, title: work.title, originalAppId: work.originalAppId, originalReleaseId: work.originalReleaseId };
      const index = workspaces.findIndex(item => item.appId === work.appId);
      if (index < 0) workspaces.push(item); else workspaces[index] = { ...workspaces[index], ...item };
      if (!context.storage.get(`run:${work.appId}`)) { context.storage.set(`run:${work.appId}`, JSON.stringify({ appId: work.appId, wish: work.wish, at: work.startedAt ?? Date.now(), phase: work.phase === "working" ? "making" : work.phase === "paused" ? "stopped" : "ready", stage: work.phase === "working" ? "making" : work.phase === "paused" ? "paused" : "ready", status: "已接回制作记录", steps: [] })); }
    }
    const serialized = JSON.stringify(workspaces);
    if (await currentAccountId() === owner && context.storage.get("workspaces") !== serialized) context.storage.set("workspaces", serialized);
}
