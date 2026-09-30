import { edgeUrl } from "./evolveHost";
import { readShellValue, removeShellValue, writeShellValue } from "./shellStorage";

const SESSION_STORAGE = "shell.julesSession.v1";
const RUN_STORAGE = "shell.julesRun.v1";
const SOURCE = "sources/github/jiangfengwhu/zjh-dynamic";

const SESSION_GUIDANCE = `你正在为紫金花 React Native Android 应用实现用户需求。以下是本会话的项目说明：
1. 先阅读相关代码，理解用户希望得到的实际行为；沿用现有架构、组件和主题，完成可使用的功能，包括必要的数据持久化、权限处理、加载、空态和错误反馈。需求不明确时采用符合现有产品的合理默认值；涉及关键歧义或缺少必要条件时明确询问用户。
2. 可复用 UI 位于 components，生成应用位于 features。新增应用使用 features/<id>/app.tsx 并调用 registerFeature(id, Component)，在 features/src/registry.ts 登记，load 使用延迟 require。若需要动态卡片和头像，参考现有 features/jolly 的登记方式。修改已有应用时保留其 ID、数据和其他功能。
3. 手机能力优先复用 features/src/lib 中的封装及现有 shell 能力，按需申请权限。不要虚构接口、硬编码凭证或用演示数据冒充真实功能。只修改完成需求所需的文件。
4. 优先通过 JS 和现有原生能力实现。当前仓库仅包含 RN 和 DEX 动态应用，Android 壳和 APK 配置在独立仓库，禁止添加或修改 Android 工程、APK 版本配置、原生依赖补丁和服务端代码。兼容性版本从 Android 壳发布的运行时契约读取，不能自行生成或更改。需要新增静态原生能力时说明需要壳维护者发布新 APK。
5. 按仓库锁文件安装所需依赖，执行与改动相关的类型检查、功能检查和构建验证。不要擅自跳过失败检查、删除检查或绕过版本基线；遇到环境、权限或凭证问题，报告具体原因。
6. 完成后在仓库根目录运行 npx tsx scripts/cloud-publish.ts，复用现有流程打包并上传 R2、更新发布清单，不要另写发布流程。发布需要环境中已配置的 R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY 和 BUNDLE_CATALOG_TOKEN；DEX 插件构建还需要 JAVA_HOME 和 ANDROID_HOME 或 ANDROID_SDK_ROOT。不得输出凭证，也不要使用 --force 绕过线上提交基线。
7. 发布前确保当前分支包含线上版本的 source.commit，必要时获取并合并最新 main，保留已有改动。按现有 PR 流程交付代码，不自行强推或合并。最后用中文说明实现内容、验证结果、发布结果及剩余限制；只有命令和上传实际成功才能报告发布成功。

下面是用户需求，请以此为本次任务的目标：`;

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
      prompt: `${SESSION_GUIDANCE}\n${prompt}`,
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
  const result = await jules("DELETE", `/v1alpha/${session}`);
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
      body: JSON.stringify({ method, path, body: body ?? "" }),
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
