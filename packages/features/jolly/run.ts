import { getAppContext } from "@zijinhua/app-sdk";
const { get: readPackageValue, set: writePackageValue, subscribe: subscribePackageValue } = getAppContext().storage;
const removeFeedPost = getAppContext().feed.remove;
const upsertFeedPost = getAppContext().feed.upsert;

export type JollyPhase = "idle" | "making" | "ready" | "stopped" | "failed";

export type JollyRun = {
  phase: JollyPhase;
  wish: string;
  status: string;
  steps: string[];
  at: number;
};

const KEY = "run";

const EMPTY: JollyRun = { phase: "idle", wish: "", status: "", steps: [], at: 0 };

export function readJollyRun(): JollyRun {
  const raw = readPackageValue(KEY);
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw) as Partial<JollyRun>;
    const phase = parsed.phase;
    if (phase !== "idle" && phase !== "making" && phase !== "ready" && phase !== "stopped" && phase !== "failed") return EMPTY;
    return {
      phase,
      wish: typeof parsed.wish === "string" ? parsed.wish : "",
      status: typeof parsed.status === "string" ? parsed.status : "",
      steps: Array.isArray(parsed.steps) ? parsed.steps.filter((item) => typeof item === "string" && item.trim()).slice(-4) : [],
      at: typeof parsed.at === "number" ? parsed.at : 0,
    };
  } catch (error) {
    console.log("jolly run unreadable", error instanceof Error ? error.message : error);
    return EMPTY;
  }
}

export function subscribeJollyRun(listener: (run: JollyRun) => void): () => void {
  listener(readJollyRun());
  return subscribePackageValue(KEY, () => listener(readJollyRun()));
}

export function jollyPhaseFromStatus(busy: boolean, status: string): JollyPhase {
  if (busy || status.includes("等待你的回复") || status.includes("正在检查新包")) return "making";
  if (status.includes("失败") || status.toLowerCase().includes("error") || status.includes("报错") || status.includes("无效") || status.includes("密钥")) return "failed";
  if (status.includes("停止") || status.includes("暂停") || status.includes("中断")) return "stopped";
  if (status.includes("最新") || status.includes("可以加载") || status.includes("已完成") || status.includes("已收好")) return "ready";
  if (!status) return "idle";
  return "failed";
}

export function noteJollyRun(input: { phase: JollyPhase; wish: string; status: string; steps?: string[] }): { prev: JollyRun; next: JollyRun } | undefined {
  const next: JollyRun = {
    phase: input.phase,
    wish: input.wish.trim(),
    status: input.status.trim(),
    steps: (input.steps ?? []).map((item) => item.trim()).filter(Boolean).slice(-4),
    at: Date.now(),
  };
  const prev = readJollyRun();
  if (prev.phase === next.phase && prev.wish === next.wish && prev.status === next.status && prev.steps.join("\n") === next.steps.join("\n")) return;
  writePackageValue(KEY, JSON.stringify(next));
  console.log("jolly run", next.phase, next.status);
  return { prev, next };
}

export function describeJollyRun(run: Pick<JollyRun, "phase" | "wish" | "status">): string {
  const wish = clip(run.wish) || "一个心愿";
  if (run.phase === "making") return `正在做「${wish}」：${run.status || "开工"}`;
  if (run.phase === "ready") return `做好了「${wish}」`;
  if (run.phase === "stopped") return `停下了「${wish}」`;
  if (run.phase === "failed") return `没做成「${wish}」：${clip(run.status, 36) || "出错"}`;
  return "";
}

/** 一次制作只对应一条动态；进度和结果原位更新，失败或中断移除。 */
export function syncJollyFeedPost(input: { startedAt: number; phase: JollyPhase; wish: string; status: string; steps: string[] }) {
  if (!Number.isFinite(input.startedAt) || input.startedAt <= 0 || input.phase === "idle") return;
  const id = `jolly-workshop-${input.startedAt}`;
  if (input.phase === "failed" || input.phase === "stopped") {
    removeFeedPost(id);
    return;
  }
  upsertFeedPost({
    id,
    kind: input.phase === "ready" ? "update" : "activity",
    body: describeJollyRun(input),
    payload: { ...input, workshopPost: true },
    createdAt: input.startedAt,
  });
}

function clip(text: string, max = 42): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max)}…`;
}
