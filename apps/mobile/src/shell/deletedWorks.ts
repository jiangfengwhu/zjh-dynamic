import { accountFetch, cachedAccountId } from "./account";
import { edgeUrl } from "./evolveHost";
import { readShellValueSync, writeShellValue, removeShellValue, shellKeys } from "./shellStorage";
import { forgetPageFamily } from "./pageCache";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { writePackageValue } from "../../../../packages/ui/packageLink";
import { invalidateMarketViews, uninstallMarketApplication } from "./market";
import { isWorkDeleted, markWorkDeleted } from "./deletedWorkState";
export { isWorkDeleted, deletedWorksRevision } from "./deletedWorkState";
const cleanups = new Map<string, Promise<void>>();
/** Mark synchronously before any await so older recovery/download results lose. */
export async function syncDeletedWorks(owner: string, appIds: string[]) {
  if (owner !== cachedAccountId()) return;
  const fresh = appIds.filter(id => /^[a-z][a-z0-9-]{0,63}$/.test(id) && id !== "jolly" && !readShellValueSync(`shell.work.deleted.cleaned.${id}`));
  if (!fresh.length) return;
  for (const id of fresh) markWorkDeleted(id, owner);
  const context = applicationContext("jolly");
  let workspaces: Array<{ appId: string }> = [];
  try { workspaces = JSON.parse(context.storage.get("workspaces") || "[]"); } catch {}
  context.storage.set("workspaces", JSON.stringify(workspaces.filter(work => !isWorkDeleted(work.appId))));
  const keys = shellKeys();
  for (const id of fresh) {
    context.storage.remove(`run:${id}`);
    context.storage.remove(`pendingPrompt.${id}`);
    for (const key of keys) {
      if (key.startsWith(`shell.jules.apps.${id}.`) || key === `shell.workshop.application.${id}` || key === `shell.market.state.${id}` || key === `shell.work.summary.${owner}.${id}` || key.startsWith(`creation.pending.${owner}.${id}.`)) removeShellValue(key);
    }
  }
  try {
    const key = `shell.works.cache.${owner}`;
    const cached = JSON.parse(readShellValueSync(key) || "null");
    if (cached) writeShellValue(key, JSON.stringify({...cached, works: cached.works.filter((work: {appId: string}) => !isWorkDeleted(work.appId))}));
  } catch {}
  for (const key of ["applications:works:", "works-gallery:", "my-summary", `author:${owner}`, "common-applications"]) forgetPageFamily(`${owner}:${key}`);
  forgetPageFamily(`discovery-start:${owner}`);
  forgetPageFamily("public:market-view:");
  invalidateMarketViews();
  writePackageValue("shell.works.changed", String(Date.now()));
  writePackageValue("shell.market.changed", String(Date.now()));
  for (const id of fresh) {
    if (cleanups.has(id)) continue;
    const pending = uninstallMarketApplication(id).then(() => { writeShellValue(`shell.work.deleted.cleaned.${id}`, "1"); }).finally(() => cleanups.delete(id));
    cleanups.set(id, pending); void pending.catch(() => {});
  }
}
export async function deleteWork(appId: string, owner: string) {
  if (cachedAccountId() !== owner) throw new Error("账号已切换，请重试");
  const response = await accountFetch(`${edgeUrl}/v1/works/${appId}`, { method: "DELETE", signal: AbortSignal.timeout(20000) }, false);
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as {message?: string};
    throw new Error(result.message || "删除未完成，请重试");
  }
  // Disposal can wait for a pending load; it must not delay removing the row.
  await syncDeletedWorks(owner, [appId]).catch(() => {});
}
