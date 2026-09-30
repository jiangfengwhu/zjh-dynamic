import { edgeUrl } from "./evolveHost";
import { readShellValue, removeShellValue, writeShellValue } from "./shellStorage";

const SESSION_STORAGE = "shell.julesSession.v1";
const RUN_STORAGE = "shell.julesRun.v1";
const APPROVAL_STORAGE = "shell.julesApproval.v1";
const SOURCE = "sources/github/jiangfengwhu/zjh-dynamic";

type CloudOutcome = "finished" | "cancelled" | "waiting";

export const CLOUD_CDN = edgeUrl;

void forgetPhoneJulesKey();

async function forgetPhoneJulesKey(): Promise<void> {
  const saved = await readShellValue("shell.julesKey.v1");
  if (!saved) return;
  removeShellValue("shell.julesKey.v1");
  console.log("jules key removed from phone");
}

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

export async function loadJulesRun(): Promise<JulesRun | undefined> {
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

export function saveJulesRun(run: JulesRun): void {
  writeShellValue(RUN_STORAGE, JSON.stringify(run));
  console.log("jules run saved", run.session);
}

export function clearJulesRun(): void {
  removeShellValue(RUN_STORAGE);
  console.log("jules run cleared");
}

export function clearJulesSession(): void {
  removeShellValue(SESSION_STORAGE);
  removeShellValue(APPROVAL_STORAGE);
  clearJulesRun();
  console.log("jules session cleared");
}

export async function runCloudEvolve(options: {
  requirement: string;
  onStatus: (status: string) => void;
  onTrace: (traces: CloudTrace[]) => void;
  onRunId: (session: string) => void;
  shouldStop: () => boolean;
}): Promise<CloudOutcome> {
  options.onStatus("正在提交到 Jules");
  const prompt = options.requirement.trim();
  const existing = await loadJulesSession();
  if (existing && (await sessionAcceptsMessage(existing))) {
    options.onRunId(existing);
    options.onStatus("正在继续同一个会话");
    const continuedAt = Date.now();
    const sent = await jules("POST", `/v1alpha/${existing}:sendMessage`, JSON.stringify({ prompt }));
    if (sent.status >= 200 && sent.status < 300) {
      console.log("jules continue", existing);
      return waitSession(existing, "", options, true, continuedAt);
    }
    throw new Error(julesError(sent));
  }
  const startedAt = Date.now();
  const created = await jules(
    "POST",
    "/v1alpha/sessions",
    JSON.stringify({
      prompt,
      title: options.requirement.slice(0, 80),
      sourceContext: {
        source: SOURCE,
        githubRepoContext: { startingBranch: "main" },
        environmentVariablesEnabled: true,
      },
      requirePlanApproval: false,
      automationMode: "AUTO_CREATE_PR",
    }),
  );
  if (created.status < 200 || created.status >= 300) throw new Error(julesError(created));
  const session = JSON.parse(created.body) as JulesSession;
  const name = session.name ?? "";
  if (!name.startsWith("sessions/")) throw new Error("Jules 没有返回会话");
  writeShellValue(SESSION_STORAGE, name);
  if (session.approvalToken) writeShellValue(APPROVAL_STORAGE, session.approvalToken);
  options.onRunId(name);
  console.log("jules session", name);
  if (options.shouldStop()) {
    await cancelCloudRun(name);
    return "cancelled";
  }
  return waitSession(name, session.url ?? "", options, false, startedAt);
}

export async function inspectJulesSession(session: string): Promise<{ state: string; url: string; title: string; startedAt: number } | undefined> {
  const current = await jules("GET", `/v1alpha/${session}`);
  if (current.status === 404) return undefined;
  if (current.status < 200 || current.status >= 300) throw new Error(julesError(current));
  const body = JSON.parse(current.body) as JulesSession;
  const startedAt = Date.parse(body.createTime ?? "");
  console.log("jules inspect", session, body.state ?? "");
  return {
    state: body.state ?? "",
    url: body.url ?? "",
    title: body.title ?? "",
    startedAt: Number.isNaN(startedAt) ? 1 : startedAt,
  };
}

export function watchJulesSession(
  session: string,
  url: string,
  options: {
    onStatus: (status: string) => void;
    onTrace: (traces: CloudTrace[]) => void;
    shouldStop: () => boolean;
  },
  sinceMs: number,
): Promise<CloudOutcome> {
  return waitSession(session, url, options, false, sinceMs);
}

export async function cancelCloudRun(session: string): Promise<void> {
  if (await loadJulesSession() !== session) return;
  const result = await jules("DELETE", `/v1alpha/${session}`);
  if (result.status < 200 || result.status >= 300) throw new Error(julesError(result));
  clearJulesSession();
  console.log("jules cancel", session, result.status);
}

export async function loadJulesSession(): Promise<string> {
  const saved = (await readShellValue(SESSION_STORAGE))?.trim() ?? "";
  return saved.startsWith("sessions/") ? saved : "";
}

export function julesSessionLive(state: string): boolean {
  return state === "QUEUED" || state === "PLANNING" || state === "IN_PROGRESS" || state === "AWAITING_PLAN_APPROVAL" || state === "AWAITING_USER_FEEDBACK";
}

async function sessionAcceptsMessage(name: string): Promise<boolean> {
  const current = await jules("GET", `/v1alpha/${name}`);
  if (current.status === 404) return false;
  if (current.status < 200 || current.status >= 300) throw new Error(julesError(current));
  const state = (JSON.parse(current.body) as JulesSession).state ?? "";
  console.log("jules session reuse", name, state);
  return state !== "FAILED";
}

export type WorkshopStatus = { completed: boolean; merged: boolean; state: string; delivery?: "unpublished" | "blocked" | "update" | "loaded"; message?: string };

export async function workshopStatus(session: string): Promise<WorkshopStatus> {
  const { buildId } = require("./build-identity.json") as { buildId: string };
  const result = await workshop({ action: "status", session, buildId });
  if (typeof result.token === "string") writeShellValue(APPROVAL_STORAGE, result.token);
  return result as WorkshopStatus;
}

export async function confirmWorkshop(session: string): Promise<void> {
  const { buildId } = require("./build-identity.json") as { buildId: string };
  await workshop({ action: "confirm", session, buildId });
}

async function workshop(input: { action: string; session: string; buildId?: string }): Promise<Record<string, unknown>> {
  const token = await readShellValue(APPROVAL_STORAGE);
  const response = await fetch(`${edgeUrl}/v1/workshop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, token }),
  });
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
  },
  expectRestart: boolean,
  sinceMs: number,
): Promise<CloudOutcome> {
  const deadline = Date.now() + 85 * 60 * 1000;
  const restartDeadline = Date.now() + 3 * 60 * 1000;
  let approved = false;
  let sawWork = !expectRestart;
  while (Date.now() < deadline) {
    if (options.shouldStop()) {
      await cancelCloudRun(name);
      return "cancelled";
    }
    await delay(5000);
    const current = await jules("GET", `/v1alpha/${name}`);
    if (current.status < 200 || current.status >= 300) throw new Error(julesError(current));
    const session = JSON.parse(current.body) as JulesSession;
    const state = session.state ?? "";
    if (state === "QUEUED" || state === "PLANNING" || state === "IN_PROGRESS" || state === "AWAITING_PLAN_APPROVAL" || state === "AWAITING_USER_FEEDBACK") {
      sawWork = true;
    }
    const view = await sessionTraces(name, state, session.url || url, sinceMs, sawWork);
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
): Promise<{ traces: CloudTrace[]; settled: boolean }> {
  const activities = (await listActivities(name)).filter((item) => inTurn(item, sinceMs));
  const settled = sawWork && turnSettled(state, activities);
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

function turnSettled(state: string, turn: JulesActivity[]): boolean {
  if (state !== "COMPLETED" || turn.length === 0) return false;
  let lastProgress = -1;
  let lastDone = -1;
  turn.forEach((item, index) => {
    if (item.progressUpdated || item.planGenerated) lastProgress = index;
    if (item.sessionCompleted) lastDone = index;
  });
  if (lastDone >= 0 && lastDone >= lastProgress) return true;
  const last = turn[turn.length - 1];
  if (last?.progressUpdated || last?.planGenerated) {
    const raw = last.createTime?.trim();
    const ms = raw ? Date.parse(raw) : Number.NaN;
    if (Number.isNaN(ms)) return false;
    return Date.now() - ms > 20_000;
  }
  return true;
}

async function listActivities(name: string): Promise<JulesActivity[]> {
  const items: JulesActivity[] = [];
  let pageToken = "";
  for (let page = 0; page < 4; page += 1) {
    const query = pageToken ? `?pageSize=100&pageToken=${encodeURIComponent(pageToken)}` : "?pageSize=100";
    const result = await jules("GET", `/v1alpha/${name}/activities${query}`);
    if (result.status < 200 || result.status >= 300) {
      console.log("jules activities failed", result.status);
      return items;
    }
    let body: { activities?: JulesActivity[]; nextPageToken?: string } = {};
    try {
      body = result.body ? JSON.parse(result.body) as typeof body : {};
    } catch (error) {
      console.log("jules activities unreadable", error instanceof Error ? error.message : error);
      return items;
    }
    items.push(...(body.activities ?? []));
    pageToken = body.nextPageToken ?? "";
    if (!pageToken) break;
  }
  return items.sort((a, b) => (a.createTime ?? "").localeCompare(b.createTime ?? ""));
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
    const response = await fetch(`${edgeUrl}/v1/jules`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ method, path, body: body ?? "", approvalToken: await readShellValue(APPROVAL_STORAGE), buildId: (require("./build-identity.json") as { buildId: string }).buildId }),
      signal: controller.signal,
    });
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
  if (result.status === 401 || result.status === 403) return "密钥无效";
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
