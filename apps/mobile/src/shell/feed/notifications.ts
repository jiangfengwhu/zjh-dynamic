import { startTransition, useEffect, useState } from "react";
import {
  accountFetch,
  currentAccountId,
  cachedAccountId,
  subscribeAccountIdentity,
} from "../account";
import { edgeUrl } from "../evolveHost";

export type Notice = {
  id: string;
  actor: { id: string; name: string; avatarUrl: string | null };
  postId: string;
  commentId: string;
  body: string;
  postPreview: string;
  kind: "like" | "comment" | "reply" | "work-success" | "work-failure" | "work-submitted";
  appId?: string;
  createdAt: number;
  read: boolean;
};
export function noticeHeading(notice: Notice) {
  if (notice.kind === "work-submitted") return "Jolly · 已提交制作";
  if (notice.kind === "work-success") return "Jolly · 制作完成";
  if (notice.kind === "work-failure") return "Jolly · 制作失败";
  return (
    notice.actor.name +
    (notice.kind === "like" ? " 赞了你的动态" : notice.kind === "reply" ? " 回复了你的评论" : " 评论了你的动态")
  );
}
type CategoryCounts = { creation: number; interaction: number };
type NoticeCounts = { unreadCount: number; unreadByCategory?: CategoryCounts };
export type NoticePage = NoticeCounts & {
  notices: Notice[];
  nextCursor: string | null;
};
let owner: string | undefined;
let count = 0;
let categoryCounts: CategoryCounts = { creation: 0, interaction: 0 };
let revision = 0;
let syncing: Promise<void> | undefined;
const listeners = new Set<(count: number) => void>();
function emit(value: number, categories?: CategoryCounts) {
  const next = Math.max(0, value);
  const nextCategories = categories ?? (next === 0 ? { creation: 0, interaction: 0 } : categoryCounts);
  if (next === count && nextCategories.creation === categoryCounts.creation && nextCategories.interaction === categoryCounts.interaction) return;
  count = next;
  categoryCounts = nextCategories;
  listeners.forEach((listener) => listener(count));
}
function identity(id?: string) {
  if (id !== owner) {
    owner = id;
    revision++;
    emit(0);
  }
}
subscribeAccountIdentity((id) => {
  identity(id ?? undefined);
  syncing = undefined;
});
export function notificationRevision() {
  return revision;
}
export function updateNotificationCount(value: number, expected?: number) {
  identity(cachedAccountId());
  if (owner && (expected === undefined || expected === revision)) {
    revision++;
    emit(value);
  }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const id = await currentAccountId();
  identity(id);
  if (!id) throw new Error("请先登录查看通知");
  const response = await accountFetch(
    `${edgeUrl}${path}`,
    { ...init, signal: AbortSignal.timeout(15000) },
    false
  );
  const result = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(result.message || "通知暂时不可用，请重试");
  if ((await currentAccountId()) !== id) throw new Error("账号已改变，请重试");
  return result;
}
export function syncNotificationCount(): Promise<void> {
  if (syncing) return syncing;
  const operation = (async () => {
    identity(await currentAccountId());
    if (!owner) return;
    const before = revision;
    const result = await request<NoticeCounts>(
      "/v1/notifications/unread"
    );
    if (before === revision) emit(result.unreadCount, result.unreadByCategory);
  })();
  const next: Promise<void> = operation.finally(() => {
    if (syncing === next) syncing = undefined;
  });
  syncing = next;
  return next;
}
export type NoticeCategory = "creation" | "interaction";
export async function readNotifications(
  cursor?: string,
  category?: NoticeCategory
) {
  identity(await currentAccountId());
  const before = revision;
  const result = await request<NoticePage>(
    `/v1/notifications?${new URLSearchParams({
      ...(cursor ? { cursor } : {}),
      ...(category ? { category } : {}),
    })}`
  );
  if (before === revision) emit(result.unreadCount, result.unreadByCategory);
  return result;
}
export async function markNotificationsRead(ids?: string[]) {
  identity(await currentAccountId());
  const before = ++revision;
  const result = await request<NoticeCounts & { before: number }>(
    "/v1/notifications/read",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }
  );
  if (before === revision) emit(result.unreadCount, result.unreadByCategory);
  return result;
}
export function useNotificationCount() {
  const [value, setValue] = useState(count);
  useEffect(() => {
    const update = (next: number) => startTransition(() => setValue(next));
    listeners.add(update);
    update(count);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return value;
}
export function useNotificationCategoryCounts() {
  const [value, setValue] = useState(categoryCounts);
  useEffect(() => {
    const update = () => startTransition(() => setValue(categoryCounts));
    listeners.add(update);
    update();
    return () => { listeners.delete(update); };
  }, []);
  return value;
}
/** Socket snapshots supersede any older in-flight HTTP count response. */
export function applyLiveNotificationCounts(value: number, categories: CategoryCounts) {
  identity(cachedAccountId());
  if (!owner) return;
  revision++;
  emit(value, categories);
}
