import { workshopContext } from "./workshopContext";
import { accountFetch, currentAccountId, requireAccount } from "./account";
import { edgeUrl } from "./evolveHost";
import {
  readShellValue,
  writeShellValue,
} from "./shellStorage";
import {
  runningApplicationReleases,
  type ApplicationManifest,
} from "../runtime/applications";
import { restoreWorks } from "./workRecovery";


const SOURCE = "sources/github/jiangfengwhu/zjh-plugin";

export type CloudTrace = {
  id: string;
  kind: "text" | "tool" | "status";
  title: string;
  detail?: string;
  state: "running" | "done" | "error";
  createdAt?: string;
};

type JulesActivity = { id?: string; name?: string; createTime?: string; agentMessaged?: { agentMessage?: string } };

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
  submissionId?: string;
  session: string;
  prompt: string;
  startedAt: number;
};

export type WorkshopStatus = {
  completed: boolean;
  branch?: string;
  state: string;
  delivery?: "unpublished" | "blocked" | "update" | "loaded";
  message?: string;
  application?: ApplicationManifest;
};
export type WorkshopDetail = {
  session: { state: string; url: string; title: string; startedAt: number };
  status: WorkshopStatus;
  traces: CloudTrace[];
  stale: boolean;
  publicReleaseId?: string;
};
const services = new Map<string, ReturnType<typeof createService>>();
export function creationService(appId: string, originalAppId?: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("应用 ID 无效");
  let service = services.get(appId);
  if (!service) {
    service = createService(appId, originalAppId);
    services.set(appId, service);
  }
  return service;
}
function createService(appId: string, originalAppId?: string) {
  const SESSION_STORAGE = `shell.jules.apps.${appId}.session`;
  const RUN_STORAGE = `shell.jules.apps.${appId}.run`;
  const APPROVAL_STORAGE = `shell.jules.apps.${appId}.token`;
  type RawDetail = {
    roundStartedAt?: number;
    submissionId?: string;
    session: JulesSession;
    status: WorkshopStatus;
    activities?: JulesActivity[];
    stale: boolean;
    sharing?: { shared?: { manifest: { releaseId: string } } | null };
  };
  let detailFlight: { key: string; promise: Promise<RawDetail> } | undefined;
  let latestDetail: { key: string; at: number; value: RawDetail } | undefined;
  async function detailKey(session: string) {
    const owner = await currentAccountId();
    if (
      !owner ||
      (await readShellValue(`shell.jules.apps.${appId}.owner`)) !== owner
    )
      throw new Error("请登录作品所属账号");
    return `${owner}:${session}:${await readShellValue(
      APPROVAL_STORAGE
    )}:${await readShellValue(RUN_STORAGE)}`;
  }
  async function fetchDetail(session: string): Promise<RawDetail> {
    const key = await detailKey(session);
    if (latestDetail?.key === key && Date.now() - latestDetail.at < 4000)
      return latestDetail.value;
    if (detailFlight?.key === key) return detailFlight.promise;
    const promise = (async () => {
      const value = (await workshop({
        action: "progress",
        session,
        applicationReleases: runningApplicationReleases(),
      })) as unknown as RawDetail;
      if (await detailKey(session) !== key)
        throw new Error("账号或制作轮次已改变，请重试");
      const run = await loadJulesRun();
      if (run?.submissionId && value.submissionId !== run.submissionId)
        throw new Error("当前轮次尚未同步，请稍后刷新");
      // Preserve the current round's last model reply if its refresh fails.
      if (value.stale && !value.activities?.length) {
        try {
          const prior = latestDetail?.key === key ? latestDetail : JSON.parse((await readShellValue(`shell.workshop.detail.${await currentAccountId()}.${appId}`)) || "null");
          if (prior?.key === key) value.activities = prior.value.activities;
        } catch {}
      }
      latestDetail = { key, at: Date.now(), value };
      const owner = await currentAccountId();
      writeShellValue(
        `shell.workshop.detail.${owner}.${appId}`,
        JSON.stringify(latestDetail)
      );
      return value;
    })();
    detailFlight = { key, promise };
    try {
      return await promise;
    } finally {
      if (detailFlight?.promise === promise) detailFlight = undefined;
    }
  }
  function detailView(value: RawDetail): WorkshopDetail {
    const startedAt = Date.parse(value.session.createTime || "");
    const status = { ...value.status };
    if (status.application)
      status.delivery =
        runningApplicationReleases()[appId] === status.application.releaseId
          ? "loaded"
          : "update";
    return {
      session: {
        state: value.session.state || "",
        url: value.session.url || "",
        title: value.session.title || "",
        startedAt: Number.isNaN(startedAt) ? 1 : startedAt,
      },
      status,
      traces: (value.activities || [])
        .filter(
          (activity) =>
            !value.roundStartedAt ||
            Date.parse(activity.createTime || "") >= value.roundStartedAt
        )
        .slice()
        .sort((a, b) => (a.createTime || "").localeCompare(b.createTime || ""))
        .flatMap(activity => {
          const reply = activity.agentMessaged?.agentMessage?.trim();
          return reply ? [{ id: activity.id || activity.name || activity.createTime || "reply", kind: "text" as const, title: "Jules", detail: reply, state: "done" as const, createdAt: activity.createTime }] : [];
        }),
      stale: value.stale,
      publicReleaseId: value.sharing?.shared?.manifest.releaseId,
    };
  }
  async function loadJulesRun(): Promise<JulesRun | undefined> {
    const owner = await currentAccountId();
    if (
      !owner ||
      (await readShellValue(`shell.jules.apps.${appId}.owner`)) !== owner
    )
      return undefined;
    const raw = await readShellValue(RUN_STORAGE);
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw) as JulesRun;
      if (
        !parsed.session?.startsWith("sessions/") ||
        !parsed.prompt ||
        !parsed.startedAt
      )
        return undefined;
      return parsed;
    } catch (error) {
      console.log(
        "jules run unreadable",
        error instanceof Error ? error.message : error
      );
      return undefined;
    }
  }

  function saveJulesRun(run: JulesRun): void {
    writeShellValue(RUN_STORAGE, JSON.stringify(run));
    // Only an accepted session belongs in the user's works; opening a draft does not.
    if (run.session.startsWith("sessions/")) {
      const context = workshopContext();
      const workspaces = JSON.parse(
        context.storage.get("workspaces") || "[]"
      ) as Array<{ appId: string; title: string }>;
      if (!workspaces.some((item) => item.appId === appId)) {
        workspaces.push({
          appId,
          title: run.prompt.replace(/\s+/g, " ").slice(0, 20),
        });
        context.storage.set("workspaces", JSON.stringify(workspaces));
      }
    }
    console.log("jules run saved", run.session);
  }

  async function submitCreation(options: {
    requirement: string;
    onRunId: (session: string) => void;
    expectedOwnerId?: string;
    continueSession?: boolean;
    submissionId?: string;
  }): Promise<void> {
    if (!(await requireAccount())) throw new Error("请先登录后再创作");
    const prompt = options.requirement.trim();
    if (!prompt) throw new Error("请描述想做什么");
    const existing = await loadJulesSession(
      !options.continueSession
    );
    if (
      options.expectedOwnerId &&
      (await currentAccountId()) !== options.expectedOwnerId
    )
      throw new Error("账号已改变，请重新提交");
    if (existing && !options.continueSession) {
      options.onRunId(existing);
      return;
    }
    if (existing) {
      const sent = await jules(
        "POST",
        `/v1alpha/${existing}:sendMessage`,
        JSON.stringify({ prompt }),
        options.submissionId
      );
      if (sent.status >= 200 && sent.status < 300) {
        options.onRunId(existing);
        console.log("jules continue", existing);
        return;
      }
      throw new Error(julesError(sent));
    }
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
      options.submissionId
    );
    if (created.status < 200 || created.status >= 300)
      throw new Error(julesError(created));
    const session = JSON.parse(created.body) as JulesSession;
    if (!submittingOwner || (await currentAccountId()) !== submittingOwner)
      throw new Error("账号已改变，请回到原账号查看制作结果");
    const name = session.name ?? "";
    if (!name.startsWith("sessions/")) throw new Error("Jules 没有返回会话");
    writeShellValue(SESSION_STORAGE, name);
    if (session.ownerId)
      writeShellValue(`shell.jules.apps.${appId}.owner`, session.ownerId);
    if (session.approvalToken)
      writeShellValue(APPROVAL_STORAGE, session.approvalToken);
    options.onRunId(name);
  }

  async function loadJulesSession(cachedOnly = false): Promise<string> {
    const owner = await currentAccountId();
    if (!owner) return "";
    if (
      !cachedOnly &&
      ((await readShellValue(`shell.jules.apps.${appId}.owner`)) !== owner ||
        !(await readShellValue(APPROVAL_STORAGE)))
    )
      await restoreWorks(false, true);
    if (
      (await readShellValue(`shell.jules.apps.${appId}.owner`)) !== owner ||
      (await currentAccountId()) !== owner
    )
      return "";
    const saved = (await readShellValue(SESSION_STORAGE))?.trim() ?? "";
    return saved.startsWith("sessions/") ? saved : "";
  }

  async function workshop(input: {
    action: string;
    session: string;
    applicationReleases?: Record<string, string>;
  }): Promise<Record<string, unknown>> {
    const token = await readShellValue(APPROVAL_STORAGE);
    const response = await accountFetch(
      `${edgeUrl}/v1/workshop`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, appId, token }),
        signal: AbortSignal.timeout(45000),
      },
      input.action !== "progress"
    );
    const result = (await response.json()) as Record<string, unknown>;
    if (!response.ok)
      throw new Error(
        typeof result.message === "string"
          ? result.message
          : "工坊暂时没有接好，请稍后再试"
      );
    return result;
  }

  async function jules(
    method: string,
    path: string,
    body?: string,
    submissionId?: string
  ): Promise<JulesResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      const context = workshopContext();
      let workspace:
        | { originalAppId?: string; originalReleaseId?: string }
        | undefined;
      try {
        workspace = JSON.parse(context.storage.get("workspaces") || "[]").find(
          (item: { appId: string }) => item.appId === appId
        );
      } catch {}
      const requestKey = `requestId.${appId}`;
      let requestId = context.storage.get(requestKey);
      if (path === "/v1alpha/sessions" && !requestId) {
        requestId = `${appId}-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2)}`;
        context.storage.set(requestKey, requestId);
      }
      const response = await accountFetch(
        `${edgeUrl}/v1/jules`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            appId,
            originalAppId: workspace?.originalAppId ?? originalAppId,
            originalReleaseId: workspace?.originalReleaseId,
            requestId: submissionId ?? requestId,
            method,
            path,
            body: body ?? "",
            approvalToken: await readShellValue(APPROVAL_STORAGE),
            buildId: (require("./build-identity.json") as { buildId: string })
              .buildId,
          }),
          signal: controller.signal,
        },
        method !== "GET"
      );
      const result = { status: response.status, body: await response.text() };
      console.log("jules", method, path, result.status);
      return result;
    } catch (error) {
      const message = controller.signal.aborted
        ? "请求超时"
        : error instanceof Error
        ? error.message
        : String(error);
      console.log("jules call failed", method, path, message);
      throw new Error(
        message.includes("失败") ? message : `Jules 失败 ${message}`
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  function julesError(result: JulesResult): string {
    if (result.status === 401) return "请重新登录后再操作作品";
    try {
      const message =
        (
          JSON.parse(result.body) as {
            error?: { message?: string };
            message?: string;
          }
        ).error?.message ??
        (JSON.parse(result.body) as { message?: string }).message;
      if (message) return message.slice(0, 180);
    } catch {
      console.log("jules error body unreadable", result.status);
    }
    return `Jules ${result.status}`;
  }

  return {
    submitCreation,
    loadJulesRun,
    saveJulesRun,
    loadJulesSession,
    readWorkshopProgress: async (session: string) => detailView(await fetchDetail(session)),
  };
}
