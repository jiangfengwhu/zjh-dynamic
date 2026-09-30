import type { ComponentType } from "react";
import type { AppAvatarProps } from "../../features/avatars/types";
import { readPackageValue, subscribePackageValue, writePackageValue } from "../packageLink";

export type FeedKind = "welcome" | "update" | "activity";
export type FeedSlot = FeedKind | "summary";

export type FeedPost = {
  id: string;
  appId: string;
  kind: FeedSlot;
  body: string;
  payload: Record<string, unknown>;
  createdAt: number;
};

/** 一位朋友在动态里的身份：名字、字标、主色，以及可选的自绘头像。 */
export type FeedFriend = {
  id: string;
  name: string;
  mark: string;
  accent: string;
  Avatar?: ComponentType<AppAvatarProps>;
};

/**
 * 朋友登记的卡片组件收到的全部内容。动态是一条时间线，每条像一条推文：
 * 壳只负责条与条之间的分隔线和进场动效，一条里的头像、名字、时间、操作由 kit 里的 PostFrame 排好。
 * 把这些属性原样交给 PostFrame，再把自己的正文（body）和附件（children）放进去。
 */
export type FeedCardProps = {
  post: FeedPost;
  friend: FeedFriend;
  /** 类别的中文名：新朋友、更新、近况、小结。 */
  kindLabel: string;
  /** 「3 分钟前」这样的相对时间。 */
  time: string;
  /** 这位朋友还有没看过的新动态。 */
  unread: boolean;
  liked: boolean;
  /** 打开这位朋友的主页。 */
  onOpen: () => void;
  onLike: () => void;
  /** 带着这位朋友的名字去工坊说一句。 */
  onReply: () => void;
};

export type FeedTemplates = Partial<Record<FeedKind, ComponentType<FeedCardProps>>>;

export type FeedChange = {
  appId: string;
  note: string;
  at: number;
};

export const SUMMARY_CHOICES = [
  { id: "30m", label: "30 分钟", ms: 30 * 60 * 1000 },
  { id: "1h", label: "1 小时", ms: 60 * 60 * 1000 },
  { id: "2h", label: "2 小时", ms: 2 * 60 * 60 * 1000 },
  { id: "6h", label: "6 小时", ms: 6 * 60 * 60 * 1000 },
  { id: "12h", label: "12 小时", ms: 12 * 60 * 60 * 1000 },
  { id: "off", label: "关闭", ms: 0 },
] as const;

const POSTS = "feed.posts.v1";
const CHANGES = "feed.changes.v1";
const SUMMARY_EVERY = "feed.summary.everyMs";
const SUMMARY_AT = "feed.summary.at";
const POST_LIMIT = 80;
const CHANGE_LIMIT = 200;
const ACTIVITY_REFRESH_MS = 15 * 60 * 1000;
const DEFAULT_EVERY = 2 * 60 * 60 * 1000;

const templates = new Map<string, FeedTemplates>();
const templateListeners = new Set<() => void>();

export function registerFeedTemplates(appId: string, next: FeedTemplates) {
  templates.set(appId, { ...templates.get(appId), ...next });
  console.log("feed templates", appId, Object.keys(next).join(","));
  for (const listener of [...templateListeners]) listener();
}

export function peekFeedTemplate(appId: string, kind: FeedKind): ComponentType<FeedCardProps> | undefined {
  return templates.get(appId)?.[kind];
}

export function subscribeFeedTemplates(listener: () => void): () => void {
  templateListeners.add(listener);
  return () => {
    templateListeners.delete(listener);
  };
}

export function readFeedPosts(): FeedPost[] {
  const raw = readPackageValue(POSTS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Partial<FeedPost>[];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const kind = normalizeKind(item?.kind);
      if (!item?.appId || !item.body || !item.createdAt || !kind) return [];
      // 旧版分开发出的制作提示仍隐藏；新版本使用同一个稳定 ID 更新整次制作。
      if (item.appId === "jolly" && (kind === "summary" || ((kind === "activity" || kind === "update") && typeof item.payload?.startedAt === "number" && item.payload.workshopPost !== true))) return [];
      return [{
        id: item.id || `${item.appId}-${kind}-${item.createdAt}`,
        appId: item.appId,
        kind,
        body: item.body,
        payload: item.payload && typeof item.payload === "object" ? item.payload : {},
        createdAt: item.createdAt,
      }];
    });
  } catch (error) {
    console.log("feed posts unreadable", error instanceof Error ? error.message : error);
    return [];
  }
}

export function subscribeFeedPosts(listener: (posts: FeedPost[]) => void): () => void {
  listener(readFeedPosts());
  return subscribePackageValue(POSTS, () => listener(readFeedPosts()));
}

/** 更新同一条动态，保留它的 ID、时间和位置，点赞等关联状态不会丢失。 */
export function upsertFeedPost(post: FeedPost) {
  const posts = readFeedPosts();
  const existing = posts.find((item) => item.id === post.id);
  const next = existing ? { ...post, createdAt: existing.createdAt } : post;
  if (existing && JSON.stringify(existing) === JSON.stringify(next)) return;
  writePosts(existing ? posts.map((item) => item.id === post.id ? next : item) : [next, ...posts].slice(0, POST_LIMIT));
}

export function removeFeedPost(id: string) {
  const posts = readFeedPosts();
  const next = posts.filter((post) => post.id !== id);
  if (next.length !== posts.length) writePosts(next);
}

export function publishFeedPost(input: { appId: string; kind: FeedSlot; body: string; payload?: Record<string, unknown> }) {
  const body = input.body.trim();
  if (!input.appId || !body) return;
  const posts = readFeedPosts();
  const payload = input.payload ?? {};
  if (input.kind === "welcome" && posts.some((item) => item.appId === input.appId && item.kind === "welcome")) return;
  if (input.kind === "update") {
    const latest = posts.find((item) => item.appId === input.appId && item.kind === "update");
    if (latest?.body === body && latest.payload.startedAt === payload.startedAt) return;
  }
  if (input.kind === "activity") {
    const latest = posts.find((item) => item.appId === input.appId && item.kind === "activity");
    if (latest && Date.now() - latest.createdAt < ACTIVITY_REFRESH_MS) {
      const next = posts.map((item) => item.id === latest.id ? { ...item, body, payload, createdAt: Date.now() } : item);
      next.sort((a, b) => b.createdAt - a.createdAt);
      writePosts(next);
      return;
    }
  }
  if (input.kind === "summary") {
    const latest = posts.find((item) => item.appId === input.appId && item.kind === "summary");
    if (latest?.body === body) return;
  }
  const post: FeedPost = {
    id: `${input.appId}-${input.kind}-${Date.now()}`,
    appId: input.appId,
    kind: input.kind,
    body,
    payload,
    createdAt: Date.now(),
  };
  writePosts([post, ...posts].slice(0, POST_LIMIT));
  console.log("feed post", input.appId, input.kind);
}

export function recordFeedChange(input: { appId: string; note: string }) {
  const note = input.note.trim();
  if (!input.appId || !note) return;
  const changes = readFeedChanges(0);
  const next: FeedChange = { appId: input.appId, note, at: Date.now() };
  writePackageValue(CHANGES, JSON.stringify([next, ...changes].slice(0, CHANGE_LIMIT)));
  console.log("feed change", input.appId, note);
}

export function readFeedChanges(since: number): FeedChange[] {
  const raw = readPackageValue(CHANGES);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as FeedChange[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && item.appId && item.note && item.at > since);
  } catch (error) {
    console.log("feed changes unreadable", error instanceof Error ? error.message : error);
    return [];
  }
}

export function readSummaryEvery(): number {
  const raw = readPackageValue(SUMMARY_EVERY);
  if (raw == null || raw === "") return DEFAULT_EVERY;
  const value = Number(raw);
  return Number.isFinite(value) ? value : DEFAULT_EVERY;
}

export function writeSummaryEvery(ms: number) {
  writePackageValue(SUMMARY_EVERY, String(ms));
  console.log("feed summary every", ms);
}

export function subscribeSummaryEvery(listener: (ms: number) => void): () => void {
  listener(readSummaryEvery());
  return subscribePackageValue(SUMMARY_EVERY, () => listener(readSummaryEvery()));
}

export function readSummaryAt(): number {
  const value = Number(readPackageValue(SUMMARY_AT) ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function writeSummaryAt(ms: number) {
  writePackageValue(SUMMARY_AT, String(ms));
}

function writePosts(posts: FeedPost[]) {
  writePackageValue(POSTS, JSON.stringify(posts));
}

function normalizeKind(kind: string | undefined): FeedSlot | undefined {
  if (kind === "hello") return "welcome";
  if (kind === "changelog") return "update";
  if (kind === "day") return "activity";
  if (kind === "welcome" || kind === "update" || kind === "activity" || kind === "summary") return kind;
  return undefined;
}
