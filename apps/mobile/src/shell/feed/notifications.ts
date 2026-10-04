import { startTransition, useEffect, useState } from "react";
import { AppState } from "react-native";
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
  kind: "comment" | "reply" | "work-success" | "work-failure";
  appId?: string;
  createdAt: number;
  read: boolean;
};
export function noticeHeading(notice: Notice) {
  if (notice.kind === "work-success") return "Jolly · 制作完成";
  if (notice.kind === "work-failure") return "Jolly · 制作失败";
  return (
    notice.actor.name +
    (notice.kind === "reply" ? " 回复了你的评论" : " 评论了你的动态")
  );
}
export type NoticePage = {
  notices: Notice[];
  nextCursor: string | null;
  unreadCount: number;
};
let owner: string | undefined;
let count = 0;
let revision = 0;
let syncing: Promise<void> | undefined;
const listeners = new Set<(count: number) => void>();
function emit(value: number) {
  const next = Math.max(0, value);
  if (next === count) return;
  count = next;
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
    const result = await request<{ unreadCount: number }>(
      "/v1/notifications/unread"
    );
    if (before === revision) emit(result.unreadCount);
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
  if (before === revision) emit(result.unreadCount);
  return result;
}
export async function markNotificationsRead(ids?: string[]) {
  identity(await currentAccountId());
  const before = ++revision;
  const result = await request<{ unreadCount: number; before: number }>(
    "/v1/notifications/read",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }
  );
  if (before === revision) emit(result.unreadCount);
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
/** One foreground poller for the shell; anonymous/background sessions make no requests. */
export function useNotificationSync() {
  useEffect(() => {
    let pending: ReturnType<typeof requestIdleCallback> | undefined;
    const sync = () => {
      if (pending !== undefined) cancelIdleCallback(pending);
      pending = requestIdleCallback(() => {
        pending = undefined;
        if (AppState.currentState === "active")
          void syncNotificationCount().catch(() => {});
      });
    };
    sync();
    const timer = setInterval(sync, 30000);
    const app = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
    });
    const off = subscribeAccountIdentity(() => sync());
    return () => {
      if (pending !== undefined) cancelIdleCallback(pending);
      clearInterval(timer);
      app.remove();
      off();
    };
  }, []);
}
