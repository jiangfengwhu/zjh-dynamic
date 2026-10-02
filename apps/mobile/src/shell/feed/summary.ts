import { AppState } from "react-native";
import { bundles } from "../../../../../packages/features/src/registry";
import {
  upsertFeedPost,
  readFeedChanges,
  readSummaryAt,
  readSummaryEvery,
  writeSummaryAt,
  type FeedChange,
} from "../../../../../packages/ui/feed";
import NativePluginHost from "../../NativePluginHost";
import { readPackageValue, writePackageValue } from "../../../../../packages/ui/packageLink";

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;
const busyListeners = new Set<(busy: boolean) => void>();
export type SummaryStatus = { error?: string; completedAt?: number; running: boolean };
const statusListeners = new Set<(status: SummaryStatus) => void>();
const STATUS_KEY = "feed.summary.status.v1";
function savedStatus(): Omit<SummaryStatus, "running"> {
  try {
    const value = JSON.parse(readPackageValue(STATUS_KEY) || "{}");
    return { error: typeof value?.error === "string" ? value.error : undefined, completedAt: typeof value?.completedAt === "number" ? value.completedAt : undefined };
  } catch { return {}; }
}
export function subscribeSummaryStatus(listener: (status: SummaryStatus) => void) {
  listener({ ...savedStatus(), running }); statusListeners.add(listener);
  return () => { statusListeners.delete(listener); };
}
function emitStatus(status = savedStatus()) { for (const listener of statusListeners) listener({ ...status, running }); }
function saveStatus(status: Omit<SummaryStatus, "running">) { writePackageValue(STATUS_KEY, JSON.stringify(status)); emitStatus(status); }
export function retryFeedSummary() { return runIfDue(true); }

export function subscribeFeedSummaryBusy(listener: (busy: boolean) => void): () => void {
  listener(running);
  busyListeners.add(listener);
  return () => {
    busyListeners.delete(listener);
  };
}

function setRunning(next: boolean) {
  if (running === next) return;
  running = next;
  console.log("feed summary busy", next);
  for (const listener of busyListeners) listener(running);
  emitStatus();
}

export function startFeedSummary() {
  if (timer) return;
  void runIfDue();
  timer = setInterval(() => void runIfDue(), 60_000);
  AppState.addEventListener("change", (state) => {
    if (state === "active") void runIfDue();
  });
  console.log("feed summary watching");
}

async function runIfDue(manual = false) {
  if (running || AppState.currentState !== "active") return;
  // Failed requests remain pending until the user explicitly retries; do not spend
  // model quota repeatedly on an unavailable engine.
  if (!manual && savedStatus().error) return;
  const every = readSummaryEvery();
  if (every <= 0) return;
  const last = readSummaryAt();
  if (!manual && last > 0 && Date.now() - last < every) return;
  const until = Date.now() - 1;
  const since = last > 0 ? last : 0;
  // 旧版本留下的制作记录也不再进入动态小结。
  const changes = readFeedChanges(since).filter((item) => item.appId !== "jolly" && item.at <= until).sort((a, b) => a.at - b.at);
  if (changes.length === 0) {
    writeSummaryAt(until);
    saveStatus({ ...savedStatus(), error: undefined });
    console.log("feed summary skipped empty");
    return;
  }
  setRunning(true);
  try {
    // Include ties so a timestamp watermark never skips an unprocessed change.
    const boundary = changes[Math.min(39, changes.length - 1)].at;
    const batch = changes.filter(item => item.at <= boundary);
    const text = await askSummary(batch);
    const posts = parseSummaries(text);
    const changed = new Set(batch.map((item) => item.appId));
    const byApp = new Map(posts.filter(post => changed.has(post.appId)).map(post => [post.appId, post.markdown]));
    if ([...changed].some(id => !byApp.has(id))) throw new Error("小结未完整生成，变更已保留，请手动重试");
    let written = 0;
    for (const [appId, body] of byApp) {
      upsertFeedPost({ id: `${appId}-summary-${boundary}`, appId, kind: "summary", body, payload: {}, createdAt: boundary });
      written += 1;
    }
    writeSummaryAt(changes.length === batch.length ? until : boundary);
    saveStatus({ completedAt: Date.now() });
    console.log("feed summary wrote", written);
  } catch (error) {
    console.log("feed summary failed", error instanceof Error ? error.message : error);
    saveStatus({ ...savedStatus(), error: error instanceof Error ? error.message : "小结未完成，变更已保留" });
  } finally {
    setRunning(false);
  }
}

async function askSummary(changes: FeedChange[]): Promise<string> {
  const apps = bundles
    .filter((bundle) => changes.some((item) => item.appId === bundle.id))
    .map((bundle) => `- ${bundle.id} ${bundle.title}：${bundle.summary}`)
    .join("\n");
  const lines = changes
    .map((item) => `- ${item.appId} ${formatStamp(item.at)} ${item.note}`)
    .join("\n");
  const raw = await NativePluginHost.call("shell", "complete", JSON.stringify({
    messages: [
      {
        role: "system",
        content: "你在替用户手机上的应用写社交动态。每个有变更的应用各写一条，用这个应用自己的口吻，像朋友发一条动态。只根据给出的变更写，没有发生的不要编。每条用一行 ## 应用id 开头，下一行起是 markdown 正文。不要写别的说明。",
      },
      {
        role: "user",
        content: `应用：\n${apps}\n\n这段时间的变更：\n${lines}`,
      },
    ],
  }));
  const parsed = JSON.parse(raw) as { ok?: boolean; text?: string; error?: string };
  if (!parsed.ok || !parsed.text?.trim()) throw new Error(parsed.error || "小结是空的");
  return parsed.text;
}

function parseSummaries(text: string): { appId: string; markdown: string }[] {
  const cleaned = text.trim().replace(/^```(?:markdown|md)?\s*/i, "").replace(/```$/, "").trim();
  return cleaned.split(/^##\s+/m).flatMap((part) => {
    const block = part.trim();
    if (!block) return [];
    const breakAt = block.indexOf("\n");
    const heading = (breakAt === -1 ? block : block.slice(0, breakAt)).trim();
    const appId = heading.split(/\s+/)[0]?.replace(/[^a-z0-9-]/gi, "") ?? "";
    const markdown = (breakAt === -1 ? "" : block.slice(breakAt + 1)).trim();
    if (!appId || !markdown) return [];
    return [{ appId, markdown }];
  });
}

function formatStamp(ms: number): string {
  const date = new Date(ms);
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}
