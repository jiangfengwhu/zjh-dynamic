import { waitForInteractions } from "./interactionWork";
import { writePackageValue } from "../../../../packages/ui/packageLink";
import { subscribeLiveEvents } from "./liveEvents";
import { accountFetch, currentAccountId } from "./account";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { readShellValue, writeShellValue } from "./shellStorage";
import { edgeUrl } from "./evolveHost";
import {
  runningApplicationReleases,
  offerApplication,
} from "../runtime/applications";
import type { WorkshopStatus } from "./cloudEvolve";
import type { SharingState } from "./market";

export type Work = {
  submissionId?: string;
  appId: string;
  ownerId: string;
  session: string;
  approvalToken: string;
  title: string;
  wish: string;
  startedAt?: number;
  phase: string;
  originalAppId?: string;
  originalReleaseId?: string;
  status?: WorkshopStatus & { stale?: boolean };
  sharing?: SharingState;
};
const restoring = new Map<string, Promise<void>>();
const refreshed = new Map<string, number>();
const hydrated = new Set<string>();
export async function hydrateWorksCache(): Promise<void> {
  const owner = await currentAccountId();
  if (!owner || hydrated.has(owner)) return;
  try {
    const cached = JSON.parse(
      (await readShellValue(`shell.works.cache.${owner}`)) || "null"
    );
    if (cached) {
      await applyWorks(owner, cached.works, true);
      hydrated.add(owner);
    }
  } catch {}
}
export async function restoreWorks(force = false, wait = false): Promise<void> {
  const owner = await currentAccountId();
  if (!owner) return;
  let cached: { at: number; works: Work[] } | undefined;
  try {
    cached =
      JSON.parse(
        (await readShellValue(`shell.works.cache.${owner}`)) || "null"
      ) ?? undefined;
  } catch {}
  await hydrateWorksCache();
  if (!force && Date.now() - (refreshed.get(owner) ?? cached?.at ?? 0) < 30000)
    return;
  const prior = restoring.get(owner);
  if (prior) {
    if (!force && !wait) return;
    try {
      await prior;
    } catch (error) {
      if (!force) throw error;
    }
    if (!force || (await currentAccountId()) !== owner) return;
    // A manual retry must issue refresh=1 after an earlier automatic request.
  }
  const pending = restore(owner, force)
    .then(() => {
      refreshed.set(owner, Date.now());
    })
    .finally(() => restoring.delete(owner));
  restoring.set(owner, pending);
  if (force || wait || !cached) await pending;
  else void pending.catch(() => {});
}
async function restore(owner: string, force: boolean) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await accountFetch(
      `${edgeUrl}/v1/works${force ? "?refresh=1" : ""}`,
      { signal: controller.signal },
      false
    );
    if (!response.ok) throw new Error("暂时无法加载作品，请稍后重试");
    const { works } = (await response.json()) as { works: Work[] };
    if ((await currentAccountId()) !== owner) return;
    await waitForInteractions();
    const previous = await readShellValue(`shell.works.cache.${owner}`);
    if ((await currentAccountId()) !== owner) return;
    writeShellValue(`shell.works.cache.${owner}`, JSON.stringify({ at: Date.now(), works }));
    await applyWorks(owner, works);
    if ((await currentAccountId()) === owner) {
      let oldWorks: unknown;
      try { oldWorks = previous ? JSON.parse(previous).works : undefined; } catch {}
      if (JSON.stringify(oldWorks) !== JSON.stringify(works)) writePackageValue("shell.works.changed", String(Date.now()));
    }
  } finally {
    clearTimeout(timer);
  }
}

async function applyWorks(owner: string, works: Work[], fromCache = false) {
  if ((await currentAccountId()) !== owner || !Array.isArray(works)) return;
  const context = applicationContext("jolly");
  let workspaces: Array<{
    appId: string;
    title: string;
    originalAppId?: string;
    originalReleaseId?: string;
  }> = [];
  try {
    workspaces = JSON.parse(context.storage.get("workspaces") || "[]");
  } catch {}
  for (const work of works) {
    if (work.ownerId !== owner || !/^[a-z][a-z0-9-]{0,63}$/.test(work.appId))
      continue;
    let currentRun: { submissionId?: string; startedAt?: number } = {};
    try {
      currentRun = JSON.parse(
        (await readShellValue(`shell.jules.apps.${work.appId}.run`)) || "{}"
      );
    } catch {}
    if ((await currentAccountId()) !== owner) return;
    // An older cache or in-flight list response cannot overwrite an accepted new round.
    if (
      currentRun.submissionId &&
      currentRun.submissionId !== work.submissionId &&
      (!work.startedAt || work.startedAt <= (currentRun.startedAt || 0))
    )
      continue;
    if (!fromCache && work.session && work.startedAt && work.wish)
      writeShellValue(
        `shell.jules.apps.${work.appId}.run`,
        JSON.stringify({
          session: work.session,
          prompt: work.wish,
          startedAt: work.startedAt,
          submissionId: work.submissionId,
        })
      );
    writeShellValue(`shell.jules.apps.${work.appId}.owner`, owner);
    writeShellValue(`shell.jules.apps.${work.appId}.token`, work.approvalToken);
    if (work.session)
      writeShellValue(`shell.jules.apps.${work.appId}.session`, work.session);
    if (work.sharing && !fromCache)
      writeShellValue(
        `shell.market.state.${work.appId}`,
        JSON.stringify(work.sharing)
      );
    if (work.status && !fromCache) {
      const status = work.status;
      const manifest = status.application;
      const loaded =
        manifest &&
        runningApplicationReleases()[work.appId] === manifest.releaseId;
      const stage =
        status.state === "FAILED"
          ? "failed"
          : status.state === "PAUSED"
          ? "paused"
          : status.state === "AWAITING_USER_FEEDBACK"
          ? "reply"
          : !status.completed
          ? "making"
          : manifest
          ? loaded
            ? "ready"
            : "load"
          : status.delivery === "blocked"
          ? "blocked"
          : "making";
      let run: Record<string, unknown> = {};
      try {
        run = JSON.parse(context.storage.get(`run:${work.appId}`) || "{}");
      } catch {}
      if (!status.stale || !run.stage) {
        context.storage.set(
          `run:${work.appId}`,
          JSON.stringify({
            ...run,
            appId: work.appId,
            wish: work.wish,
            stage,
            phase: ["ready", "load", "blocked"].includes(stage)
              ? "ready"
              : stage === "paused"
              ? "stopped"
              : stage === "failed"
              ? "failed"
              : "making",
            status: status.message,
            steps: run.steps ?? [],
            at: work.startedAt ?? Date.now(),
          })
        );
      }
      writeShellValue(
        `shell.work.summary.${owner}.${work.appId}`,
        JSON.stringify({ stale: Boolean(status.stale) })
      );
      if (manifest) {
        writeShellValue(
          `shell.workshop.application.${work.appId}`,
          JSON.stringify(manifest)
        );
        if (!status.stale && !loaded) {
          try {
            offerApplication(manifest, owner);
          } catch {
            /* Package compatibility/loading is separate from successfully synced production status. */
          }
        }
      }
    }
    const item = {
      appId: work.appId,
      title: work.status?.application?.appName || work.title,
      originalAppId: work.originalAppId,
      originalReleaseId: work.originalReleaseId,
    };
    const index = workspaces.findIndex((item) => item.appId === work.appId);
    if (index < 0) workspaces.push(item);
    else workspaces[index] = { ...workspaces[index], ...item };
    if (work.startedAt) {
      let existing: Record<string, unknown> = {};
      try {
        existing = JSON.parse(context.storage.get(`run:${work.appId}`) || "{}");
      } catch {}
      if (existing.at !== work.startedAt && existing.stage)
        context.storage.set(
          `run:${work.appId}`,
          JSON.stringify({ ...existing, at: work.startedAt })
        );
    }
    if (!context.storage.get(`run:${work.appId}`)) {
      context.storage.set(
        `run:${work.appId}`,
        JSON.stringify({
          appId: work.appId,
          wish: work.wish,
          at: work.startedAt ?? Date.now(),
          phase:
            work.phase === "working"
              ? "making"
              : work.phase === "paused"
              ? "stopped"
              : "ready",
          stage:
            work.phase === "working"
              ? "making"
              : work.phase === "paused"
              ? "paused"
              : "ready",
          status: "已同步制作记录",
          steps: [],
        })
      );
    }
  }
  const serialized = JSON.stringify(workspaces);
  if (
    (await currentAccountId()) === owner &&
    context.storage.get("workspaces") !== serialized
  )
    context.storage.set("workspaces", serialized);
}

// Events request only the local BFF snapshot; upstream progress stays manual.
let workEventSync: Promise<void> | undefined;
let workEventAgain = false;
subscribeLiveEvents(event => {
  if (event.type !== "work" && event.type !== "ready") return;
  workEventAgain = true;
  if (workEventSync) return;
  workEventSync = (async () => {
    while (workEventAgain) {
      workEventAgain = false;
      const owner = await currentAccountId();
      if (!owner) return;
      const prior = restoring.get(owner);
      if (prior) await prior.catch(() => {});
      if (await currentAccountId() !== owner) return;
      const operation = restore(owner, false);
      restoring.set(owner, operation);
      try { await operation; refreshed.set(owner, Date.now()); }
      finally { if (restoring.get(owner) === operation) restoring.delete(owner); }
    }
  })().catch(() => {}).finally(() => { workEventSync = undefined; });
});
