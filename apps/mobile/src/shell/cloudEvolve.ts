import { accountFetch, currentAccountId, requireAccount } from "./account";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { edgeUrl } from "./evolveHost";
import { readShellValue, removeShellValue, writeShellValue } from "./shellStorage";
import { runningApplicationReleases, offerApplication, type ApplicationManifest } from "../runtime/applications";
import { restoreWorks } from "./workRecovery";
import { confirmCreation } from "./creationConsent";
import { AppState } from "react-native";
import type { WorkshopDetail } from "../../../../packages/app-sdk/src/creation";

const SOURCE = "sources/github/jiangfengwhu/zjh-plugin";
type CloudOutcome = "finished" | "cancelled" | "waiting";
export type CloudTrace = {
  id: string;
  kind: "text" | "tool" | "status";
  title: string;
  detail?: string;
  state: "running" | "done" | "error";
};

type JulesActivity = {
  id?: string;
  name?: string;
  description?: string;
  createTime?: string;
  agentMessaged?: { agentMessage?: string };
  planGenerated?: { plan?: { steps?: { title?: string; description?: string; index?: number }[] } };
  planApproved?: Record<string, unknown>;
  progressUpdated?: { title?: string; description?: string };
  sessionCompleted?: Record<string, unknown>;
  sessionFailed?: { reason?: string };
  artifacts?: { bashOutput?: { command?: string; output?: string; exitCode?: number } }[];
};

type JulesResult = { status: number; body: string };

type JulesSession = {
  ownerId?: string;
  approvalToken?: string;
  name?: string;
  state?: string;
  url?: string;
  title?: string;
  createTime?: string;
};

export type JulesRun = {
  session: string;
  prompt: string;
  startedAt: number;
};

export type WorkshopStatus = { completed: boolean; branch?: string; state: string; delivery?: "unpublished" | "blocked" | "update" | "loaded"; message?: string; application?: ApplicationManifest };
const services = new Map<string, ReturnType<typeof createService>>();
export function creationService(appId: string, originalAppId?: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("应用 ID 无效");
  let service = services.get(appId);
  if (!service) { service = createService(appId, originalAppId); services.set(appId, service); }
  return service;
}
function createService(appId: string, originalAppId?: string) {
const SESSION_STORAGE = `shell.jules.apps.${appId}.session`;
const RUN_STORAGE = `shell.jules.apps.${appId}.run`;
const APPROVAL_STORAGE = `shell.jules.apps.${appId}.token`;
type RawDetail = { session: JulesSession; status: WorkshopStatus; activities?: JulesActivity[]; nextPageToken?: string; stale: boolean; sharing?: { shared?: { manifest: { releaseId: string } } | null } };
let detailFlight: { key: string; promise: Promise<RawDetail> } | undefined;
let latestDetail: { key: string; at: number; value: RawDetail } | undefined;
async function detailKey(session: string) {
  const owner = await currentAccountId();
  if (!owner || await readShellValue(`shell.jules.apps.${appId}.owner`) !== owner) throw new Error("请重新接回当前账号的作品");
  return `${owner}:${session}:${await readShellValue(APPROVAL_STORAGE)}:${await readShellValue(RUN_STORAGE)}`;
}
async function fetchDetail(session: string): Promise<RawDetail> {
  const key = await detailKey(session);
  if (latestDetail?.key === key && Date.now() - latestDetail.at < 4000) return latestDetail.value;
  if (detailFlight?.key === key) return detailFlight.promise;
  const promise = (async () => {
    const value = await workshop({ action: "detail", session, applicationReleases: runningApplicationReleases() }) as unknown as RawDetail;
    if (await detailKey(session) !== key) throw new Error("账号或制作轮次已改变，请重试");
    latestDetail = { key, at: Date.now(), value };
    const owner = await currentAccountId();
    writeShellValue(`shell.workshop.detail.${owner}.${appId}`, JSON.stringify(latestDetail));
    return value;
  })();
  detailFlight = { key, promise };
  try { return await promise; } finally { if (detailFlight?.promise === promise) detailFlight = undefined; }
}
function detailView(value: RawDetail): WorkshopDetail {
  const startedAt = Date.parse(value.session.createTime || "");
  const status = { ...value.status };
  if (status.application) status.delivery = runningApplicationReleases()[appId] === status.application.releaseId ? "loaded" : "update";
  return { session: { state: value.session.state || "", url: value.session.url || "", title: value.session.title || "", startedAt: Number.isNaN(startedAt) ? 1 : startedAt }, status,
    traces: (value.activities || []).slice().sort((a, b) => (a.createTime || "").localeCompare(b.createTime || "")).flatMap(activityTrace), historyCursor: value.nextPageToken, stale: value.stale, publicReleaseId: value.sharing?.shared?.manifest.releaseId };
}
async function readWorkshopDetail(session: string, cachedOnly = false): Promise<WorkshopDetail | undefined> {
  if (!cachedOnly) return detailView(await fetchDetail(session));
  const key = await detailKey(session); const owner = await currentAccountId();
  try {
    const cached = JSON.parse(await readShellValue(`shell.workshop.detail.${owner}.${appId}`) || "null");
    if (cached?.key === key && await detailKey(session) === key) return { ...detailView(cached.value), stale: true };
  } catch {}
  return undefined;
}
async function readWorkshopHistory(session: string, cursor: string) {
  const key = await detailKey(session);
  const page = await workshop({ action: "activities", session, pageToken: cursor }) as { activities?: JulesActivity[]; nextPageToken?: string };
  if (await detailKey(session) !== key) throw new Error("账号或制作轮次已改变，请重试");
  return { traces: (page.activities || []).sort((a, b) => (a.createTime || "").localeCompare(b.createTime || "")).flatMap(activityTrace), nextCursor: page.nextPageToken };
}
async function loadJulesRun(): Promise<JulesRun | undefined> {
  const owner = await currentAccountId();
  if (!owner || await readShellValue(`shell.jules.apps.${appId}.owner`) !== owner) return undefined;
  const raw = await readShellValue(RUN_STORAGE);
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as JulesRun;
    if (!parsed.session?.startsWith("sessions/") || !parsed.prompt || !parsed.startedAt) return undefined;
    return parsed;
  } catch (error) {
    console.log("jules run unreadable", error instanceof Error ? error.message : error);
    return undefined;
  }
}

function saveJulesRun(run: JulesRun): void {
  writeShellValue(RUN_STORAGE, JSON.stringify(run));
  // Only an accepted session belongs in the user's works; opening a draft does not.
  if (run.session.startsWith("sessions/")) {
    const context = applicationContext("jolly");
    const workspaces = JSON.parse(context.storage.get("workspaces") || "[]") as Array<{ appId: string; title: string }>;
    if (!workspaces.some(item => item.appId === appId)) {
      workspaces.push({ appId, title: run.prompt.replace(/\s+/g, " ").slice(0, 20) });
      context.storage.set("workspaces", JSON.stringify(workspaces));
    }
  }
  console.log("jules run saved", run.session);
}

function clearJulesRun(): void {
  removeShellValue(RUN_STORAGE);
  console.log("jules run cleared");
}

function clearJulesSession(): void {
  removeShellValue(SESSION_STORAGE);
  clearJulesRun();
  console.log("jules session cleared");
}

async function runCloudEvolve(options: {
  requirement: string;
  onStatus: (status: string) => void;
  onTrace: (traces: CloudTrace[]) => void;
  onRunId: (session: string) => void;
  shouldStop: () => boolean;
  shouldPause?: () => boolean;
  submitOnly?: boolean;
  expectedOwnerId?: string;
}): Promise<CloudOutcome> {
  if (!await requireAccount()) throw new Error("请先登录后再创作");
  options.onStatus("正在提交到 Jules");
  const prompt = options.requirement.trim();
  if (!prompt) throw new Error("请描述想做什么");
  const existing = await loadJulesSession(!!options.submitOnly);
  if (options.expectedOwnerId && await currentAccountId() !== options.expectedOwnerId)
    throw new Error("账号已改变，请重新提交");
  if (existing && options.submitOnly) {
    options.onRunId(existing);
    return "waiting";
  }
  if (existing && (await sessionAcceptsMessage(existing))) {
    options.onRunId(existing);
    options.onStatus("正在继续这个应用的会话");
    const continuedAt = Date.now();
    const sent = await jules("POST", `/v1alpha/${existing}:sendMessage`, JSON.stringify({ prompt }));
    if (sent.status >= 200 && sent.status < 300) {
      console.log("jules continue", existing);
      return waitSession(existing, "", options, true, continuedAt);
    }
    throw new Error(julesError(sent));
  }
  if (existing) throw new Error("这个应用的 session 暂时不能继续，请停止后再重试");
  const startedAt = Date.now();
  const submittingOwner = await currentAccountId();
  if (options.expectedOwnerId && submittingOwner !== options.expectedOwnerId)
    throw new Error("账号已改变，请重新提交");
  const created = await jules(
    "POST",
    "/v1alpha/sessions",
    JSON.stringify({
      prompt,
      title: options.requirement.slice(0, 80),
      sourceContext: {
        source: SOURCE,
        githubRepoContext: { startingBranch: "main" },
        environmentVariablesEnabled: false,
      },
      requirePlanApproval: false,
      automationMode: "AUTO_CREATE_PR",
    }),
  );
  if (created.status < 200 || created.status >= 300) throw new Error(julesError(created));
  const session = JSON.parse(created.body) as JulesSession;
  if (!submittingOwner || await currentAccountId() !== submittingOwner)
    throw new Error("账号已改变，请回到原账号查看制作结果");
  const name = session.name ?? "";
  if (!name.startsWith("sessions/")) throw new Error("Jules 没有返回会话");
  writeShellValue(SESSION_STORAGE, name);
  if (session.ownerId) writeShellValue(`shell.jules.apps.${appId}.owner`, session.ownerId);
  if (session.approvalToken) writeShellValue(APPROVAL_STORAGE, session.approvalToken);
  options.onRunId(name);
  if (options.submitOnly) return "waiting";
  console.log("jules session", name);
  if (options.shouldStop()) {
    return "cancelled";
  }
  return waitSession(name, session.url ?? "", options, false, startedAt);
}

async function inspectJulesSession(session: string): Promise<{ state: string; url: string; title: string; startedAt: number } | undefined> {
  return (await readWorkshopDetail(session))?.session;
}

function watchJulesSession(
  session: string,
  url: string,
  options: {
    onStatus: (status: string) => void;
    onTrace: (traces: CloudTrace[]) => void;
    shouldStop: () => boolean;
    shouldPause?: () => boolean;
  },
  sinceMs: number,
): Promise<CloudOutcome> {
  return waitSession(session, url, options, false, sinceMs);
}

async function cancelCloudRun(session: string): Promise<void> {
  if (await loadJulesSession() !== session) return;
  await confirmCreation("停止制作", appId);
  await workshop({ action: "stop", session });
  clearJulesRun();
  console.log("jules stop requested", session);
}

async function loadJulesSession(cachedOnly = false): Promise<string> {
  const owner = await currentAccountId(); if (!owner) return "";
  if (!cachedOnly && (await readShellValue(`shell.jules.apps.${appId}.owner`) !== owner || !await readShellValue(APPROVAL_STORAGE))) await restoreWorks(true);
  if (await readShellValue(`shell.jules.apps.${appId}.owner`) !== owner || await currentAccountId() !== owner) return "";
  const saved = (await readShellValue(SESSION_STORAGE))?.trim() ?? "";
  return saved.startsWith("sessions/") ? saved : "";
}

function julesSessionLive(state: string): boolean {
  return state === "QUEUED" || state === "PLANNING" || state === "IN_PROGRESS" || state === "AWAITING_PLAN_APPROVAL" || state === "AWAITING_USER_FEEDBACK";
}

async function sessionAcceptsMessage(name: string): Promise<boolean> {
  const current = await jules("GET", `/v1alpha/${name}`);
  if (current.status === 404) return false;
  if (current.status < 200 || current.status >= 300) throw new Error(julesError(current));
  const state = (JSON.parse(current.body) as JulesSession).state ?? "";
  console.log("jules session reuse", name, state);
  return Boolean(state);
}


async function workshopStatus(session: string): Promise<WorkshopStatus> {
  const ownerId = await currentAccountId();
  const result = detailView(await fetchDetail(session)).status;
  if (await currentAccountId() !== ownerId) throw new Error("账号已改变，请重试");
  if (result.application) {
    const manifest = result.application as ApplicationManifest;
    writeShellValue(`shell.workshop.application.${appId}`, JSON.stringify(manifest));
    const context = applicationContext("jolly");
    const workspaces = JSON.parse(context.storage.get("workspaces") || "[]") as Array<{ appId: string; title: string }>;
    const workspace = workspaces.find(item => item.appId === appId);
    if (workspace && manifest.title && workspace.title !== manifest.title) { workspace.title = manifest.title; context.storage.set("workspaces", JSON.stringify(workspaces)); }
  }
  if (result.application && result.delivery === "update") { if (ownerId && await currentAccountId() === ownerId) offerApplication(result.application as ApplicationManifest, ownerId); }
  if (await currentAccountId() !== ownerId) throw new Error("账号已改变，请重试");
  return result as WorkshopStatus;
}

async function workshop(input: { action: string; session: string; buildId?: string; applicationReleases?: Record<string, string>; pageToken?: string }): Promise<Record<string, unknown>> {
  const token = await readShellValue(APPROVAL_STORAGE);
  const response = await accountFetch(`${edgeUrl}/v1/workshop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, appId, token }),
    signal: AbortSignal.timeout(45000),
  }, !["status", "detail", "activities"].includes(input.action));
  const result = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : "工坊暂时没有接好，请稍后再试");
  return result;
}

async function waitSession(
  name: string,
  url: string,
  options: {
    onStatus: (status: string) => void;
    onTrace: (traces: CloudTrace[]) => void;
    shouldStop: () => boolean;
    shouldPause?: () => boolean;
  },
  expectRestart: boolean,
  sinceMs: number,
): Promise<CloudOutcome> {
  let deadline = Date.now() + 85 * 60 * 1000;
  let restartDeadline = Date.now() + 3 * 60 * 1000;
  let approved = false;
  let sawWork = !expectRestart;
  const owner = await currentAccountId();
  while (Date.now() < deadline) {
    if (options.shouldStop()) return "cancelled";
    const pollAt = Date.now();
    await delay(5000);
    if (options.shouldStop() || await currentAccountId() !== owner) return "cancelled";
    if (AppState.currentState !== "active" || options.shouldPause?.()) {
      const pausedFor = Date.now() - pollAt; deadline += pausedFor; restartDeadline += pausedFor; continue;
    }
    const detail = await fetchDetail(name);
    if (options.shouldStop() || await currentAccountId() !== owner) return "cancelled";
    const session = detail.session;
    const state = session.state ?? "";
    if (state === "QUEUED" || state === "PLANNING" || state === "IN_PROGRESS" || state === "AWAITING_PLAN_APPROVAL" || state === "AWAITING_USER_FEEDBACK") {
      sawWork = true;
    }
    const view = await sessionTraces(name, state, session.url || url, sinceMs, sawWork, detail);
    options.onTrace(view.traces);
    const latest = [...view.traces].reverse().find((item) => item.kind !== "text");
    console.log("jules state", state, "activities", view.traces.length, latest?.title ?? "", view.settled ? "settled" : "open");
    if ((state === "COMPLETED" || state === "PAUSED") && !sawWork) {
      if (Date.now() > restartDeadline) throw new Error("会话没有接着做");
      options.onStatus("正在继续同一个会话");
      continue;
    }
    if (state === "COMPLETED" && view.settled) return "finished";
    if (state === "FAILED") throw new Error("Jules 失败");
    if (state === "PAUSED") throw new Error("Jules 已暂停");
    if (state === "AWAITING_PLAN_APPROVAL" && !approved) {
      approved = true;
      await jules("POST", `/v1alpha/${name}:approvePlan`, "{}");
    }
    if (state === "AWAITING_USER_FEEDBACK") {
      options.onStatus("Jules 等待你的回复");
      return "waiting";
    }
    options.onStatus(clip(latest?.title || stateLabel(state), 80));
  }
  throw new Error("线上定制超时");
}

async function sessionTraces(
  name: string,
  state: string,
  url: string,
  sinceMs: number,
  sawWork: boolean,
  detail: RawDetail,
): Promise<{ traces: CloudTrace[]; settled: boolean }> {
  const activities = (detail.activities || []).filter((item) => inTurn(item, sinceMs));
  const settled = sawWork && state === "COMPLETED";
  const waitingRestart = !sawWork && (state === "COMPLETED" || state === "PAUSED");
  const traces = activities.flatMap((item) => activityTrace(item));
  const note = [...traces].reverse().find((item) => item.kind === "text");
  const steps = traces.filter((item) => item.kind !== "text");
  if (steps.length === 0) {
    steps.push({
      id: "jules",
      kind: "status",
      title: waitingRestart ? "正在继续同一个会话" : stateLabel(state),
      detail: url,
      state: "running",
    });
  }
  if (settled) {
    steps.push({ id: "jules-settled", kind: "status", title: "完成", state: "done" });
  }
  const failed = state === "FAILED";
  const marked = steps.map((item, index) => ({
    ...item,
    state: failed && index === steps.length - 1 ? "error" as const : settled || index < steps.length - 1 ? "done" as const : "running" as const,
  }));
  return { traces: note ? [...marked, note] : marked, settled };
}

function inTurn(activity: JulesActivity, sinceMs: number): boolean {
  const raw = activity.createTime?.trim();
  if (!raw) return true;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return true;
  return ms >= sinceMs - 15_000;
}

function activityTrace(activity: JulesActivity): CloudTrace[] {
  const id = activity.id || activity.name || activity.createTime || "activity";
  if (activity.progressUpdated) {
    const described = activity.progressUpdated.description?.trim() || activity.description?.trim() || "";
    const title = activity.progressUpdated.title?.trim() || described;
    if (!title) return [];
    const bash = (activity.artifacts ?? [])
      .map((item) => item.bashOutput)
      .filter((item): item is { command?: string; output?: string; exitCode?: number } => Boolean(item))
      .map((item) => `$ ${(item.command ?? "").trim()}\n${item.output ?? ""}`.trim())
      .join("\n\n");
    const detail = [described, bash].filter(Boolean).join("\n\n");
    return [{ id, kind: "tool", title: clip(title, 120), detail: clip(detail, 1200), state: "done" }];
  }
  const steps = activity.planGenerated?.plan?.steps ?? [];
  if (steps.length > 0) {
    const detail = [...steps]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((step, index) => `${index + 1}. ${step.title?.trim() || "步骤"}${step.description?.trim() ? `：${step.description.trim()}` : ""}`)
      .join("\n");
    return [{ id, kind: "status", title: "计划", detail: clip(detail, 1200), state: "done" }];
  }
  if (activity.planApproved) {
    return [{ id, kind: "status", title: "计划已确认", state: "done" }];
  }
  if (activity.sessionFailed) {
    return [{ id, kind: "status", title: "失败", detail: clip(activity.sessionFailed.reason?.trim() || "", 400), state: "error" }];
  }
  if (activity.sessionCompleted) return [];
  const message = activity.agentMessaged?.agentMessage?.trim();
  if (message) {
    const line = message.split("\n").map((item) => item.trim()).find(Boolean) || "Jules";
    return [{ id, kind: "text", title: clip(line, 80), detail: clip(message, 2000), state: "done" }];
  }
  return [];
}

function clip(text: string, max: number): string {
  const flat = text.replace(/\r\n/g, "\n").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max)}…`;
}

function stateLabel(state: string): string {
  if (state === "QUEUED") return "排队中";
  if (state === "PLANNING") return "正在计划";
  if (state === "AWAITING_PLAN_APPROVAL") return "正在确认计划";
  if (state === "IN_PROGRESS") return "正在实现并打包";
  if (state === "AWAITING_USER_FEEDBACK") return "等待你的回复";
  if (state === "COMPLETED") return "已完成";
  return "线上定制进行中";
}

async function jules(method: string, path: string, body?: string): Promise<JulesResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const context = applicationContext("jolly");
    let workspace: { originalAppId?: string; originalReleaseId?: string } | undefined;
    try { workspace = JSON.parse(context.storage.get("workspaces") || "[]").find((item: { appId: string }) => item.appId === appId); } catch {}
    const requestKey = `requestId.${appId}`;
    let requestId = context.storage.get(requestKey);
    if (path === "/v1alpha/sessions" && !requestId) { requestId = `${appId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; context.storage.set(requestKey, requestId); }
    const response = await accountFetch(`${edgeUrl}/v1/jules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ appId, originalAppId: workspace?.originalAppId ?? originalAppId, originalReleaseId: workspace?.originalReleaseId, requestId, method, path, body: body ?? "", approvalToken: await readShellValue(APPROVAL_STORAGE), buildId: (require("./build-identity.json") as { buildId: string }).buildId }),
      signal: controller.signal,
    }, method !== "GET");
    const result = { status: response.status, body: await response.text() };
    console.log("jules", method, path, result.status);
    return result;
  } catch (error) {
    const message = controller.signal.aborted ? "请求超时" : error instanceof Error ? error.message : String(error);
    console.log("jules call failed", method, path, message);
    throw new Error(message.includes("失败") ? message : `Jules 失败 ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function julesError(result: JulesResult): string {
  if (result.status === 401) return "请重新登录后再操作作品";
  try {
    const message = (JSON.parse(result.body) as { error?: { message?: string }; message?: string }).error?.message
      ?? (JSON.parse(result.body) as { message?: string }).message;
    if (message) return message.slice(0, 180);
  } catch {
    console.log("jules error body unreadable", result.status);
  }
  return `Jules ${result.status}`;
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(undefined), ms);
  });
}

return { runCloudEvolve, cancelCloudRun, loadJulesRun, saveJulesRun, clearJulesRun, clearJulesSession, loadJulesSession, inspectJulesSession, julesSessionLive, watchJulesSession, workshopStatus, readWorkshopDetail, readWorkshopHistory };
}
