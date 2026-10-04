import { applicationContext } from "../../../../../packages/app-sdk/src/runtime";
const getAppContext = () => applicationContext("jolly");
const {
  get: readPackageValue,
  set: writePackageValue,
  subscribe: subscribePackageValue,
} = getAppContext().storage;

export type JollyPhase = "idle" | "making" | "ready" | "stopped" | "failed";

export type WorkshopStage =
  | "draft"
  | "making"
  | "reply"
  | "load"
  | "ready"
  | "paused"
  | "failed"
  | "blocked";
export const workshopStageLabels: Record<WorkshopStage, string> = {
  draft: "尚未开始",
  making: "制作中",
  reply: "等待回复",
  load: "待体验",
  ready: "可使用",
  paused: "已暂停",
  failed: "制作未完成",
  blocked: "需要处理",
};
export type JollyRun = {
  stage?: WorkshopStage;
  phase: JollyPhase;
  wish: string;
  status: string;
  steps: string[];
  at: number;
};

const KEY = "run";

const EMPTY: JollyRun = {
  phase: "idle",
  wish: "",
  status: "",
  steps: [],
  at: 0,
};

export function readJollyRun(appId?: string): JollyRun {
  const raw = readPackageValue(appId ? `run:${appId}` : KEY);
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<JollyRun>;
    const phase = parsed.phase;
    if (
      phase !== "idle" &&
      phase !== "making" &&
      phase !== "ready" &&
      phase !== "stopped" &&
      phase !== "failed"
    )
      return EMPTY;
    return {
      phase,
      stage:
        parsed.stage && workshopStageLabels[parsed.stage]
          ? parsed.stage
          : undefined,
      wish: typeof parsed.wish === "string" ? parsed.wish : "",
      status: typeof parsed.status === "string" ? parsed.status : "",
      steps: Array.isArray(parsed.steps)
        ? parsed.steps
            .filter((item) => typeof item === "string" && item.trim())
            .slice(-4)
        : [],
      at: typeof parsed.at === "number" ? parsed.at : 0,
    };
  } catch (error) {
    console.log(
      "jolly run unreadable",
      error instanceof Error ? error.message : error
    );
    return EMPTY;
  }
}

export function subscribeJollyRun(
  listener: (run: JollyRun) => void,
  appId?: string
): () => void {
  listener(readJollyRun(appId));
  return subscribePackageValue(appId ? `run:${appId}` : KEY, () =>
    listener(readJollyRun(appId))
  );
}

export function jollyPhaseFromStatus(
  busy: boolean,
  status: string
): JollyPhase {
  if (
    busy ||
    status.includes("等待你的回复") ||
    status.includes("正在检查新包")
  )
    return "making";
  if (
    status.includes("失败") ||
    status.toLowerCase().includes("error") ||
    status.includes("报错") ||
    status.includes("无效") ||
    status.includes("密钥")
  )
    return "failed";
  if (
    status.includes("停止") ||
    status.includes("暂停") ||
    status.includes("中断")
  )
    return "stopped";
  if (
    status.includes("最新") ||
    status.includes("可以加载") ||
    status.includes("已完成") ||
    status.includes("已收好")
  )
    return "ready";
  if (!status) return "idle";
  return "failed";
}

export function noteJollyRun(input: {
  appId?: string;
  phase: JollyPhase;
  wish: string;
  status: string;
  steps?: string[];
  stage?: WorkshopStage;
}): { prev: JollyRun; next: JollyRun } | undefined {
  const prev = readJollyRun(input.appId);
  const next: JollyRun = {
    stage: input.stage ?? prev.stage,
    phase: input.phase,
    wish: input.wish.trim(),
    status: input.status.trim(),
    steps: (input.steps ?? [])
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(-4),
    at: Date.now(),
  };
  if (
    prev.stage === next.stage &&
    prev.phase === next.phase &&
    prev.wish === next.wish &&
    prev.status === next.status &&
    prev.steps.join("\n") === next.steps.join("\n")
  )
    return;
  if (input.appId)
    writePackageValue(`run:${input.appId}`, JSON.stringify(next));
  writePackageValue(KEY, JSON.stringify(next));
  console.log("jolly run", next.phase, next.status);
  return { prev, next };
}

export function describeJollyRun(
  run: Pick<JollyRun, "phase" | "wish" | "status">
): string {
  const wish = clip(run.wish) || "一个心愿";
  if (run.phase === "making")
    return `正在做「${wish}」：${run.status || "开工"}`;
  if (run.phase === "ready") return `做好了「${wish}」`;
  if (run.phase === "stopped") return `停下了「${wish}」`;
  if (run.phase === "failed")
    return `没做成「${wish}」：${clip(run.status, 36) || "出错"}`;
  return "";
}

function clip(text: string, max = 42): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max)}…`;
}
