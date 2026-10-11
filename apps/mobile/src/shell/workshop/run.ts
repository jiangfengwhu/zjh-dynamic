import { workshopContext } from "../workshopContext";
const getAppContext = () => workshopContext();
const {
  get: readPackageValue,
  set: writePackageValue,
} = getAppContext().storage;

export type WorkshopPhase = "idle" | "making" | "ready" | "stopped" | "failed";

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
export type WorkshopRun = {
  stage?: WorkshopStage;
  phase: WorkshopPhase;
  wish: string;
  status: string;
  steps: string[];
  at: number;
};

const KEY = "run";

const EMPTY: WorkshopRun = {
  phase: "idle",
  wish: "",
  status: "",
  steps: [],
  at: 0,
};

export function readWorkshopRun(appId?: string): WorkshopRun {
  const raw = readPackageValue(appId ? `run:${appId}` : KEY);
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<WorkshopRun>;
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
      "workshop run unreadable",
      error instanceof Error ? error.message : error
    );
    return EMPTY;
  }
}

export function noteWorkshopRun(input: {
  appId?: string;
  phase: WorkshopPhase;
  wish: string;
  status: string;
  steps?: string[];
  stage?: WorkshopStage;
}): { prev: WorkshopRun; next: WorkshopRun } | undefined {
  const prev = readWorkshopRun(input.appId);
  const next: WorkshopRun = {
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
  console.log("workshop run", next.phase, next.status);
  return { prev, next };
}
