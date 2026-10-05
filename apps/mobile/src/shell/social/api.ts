import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { accountFetch, accountSocket, cachedAccountId, currentAccountId, subscribeAccountIdentity, useAccount } from "../account";
import { edgeUrl } from "../evolveHost";
import type { PublicAuthor } from "../feed/userPosts";

export type RelationKind = "following" | "followers";
export type Relation = { author: PublicAuthor; following: boolean; followsYou: boolean };
export type RelationPage = { authors: Relation[]; nextCursor: string | null };
export type Message = { id: string; senderId: string; body: string; createdAt: number };
export type Conversation = { peer: PublicAuthor; lastMessage: Message; unreadCount: number };
export type InboxPage = { conversations: Conversation[]; nextCursor: string | null; unreadCount: number };
export type MessagePage = { peer: PublicAuthor; messages: Message[]; nextCursor: string | null };
async function request<T>(path: string, body?: unknown, publicRead = false): Promise<T> {
  const owner = await currentAccountId();
  const init: RequestInit = { signal: AbortSignal.timeout(15000), ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) };
  const response = publicRead && !owner ? await fetch(edgeUrl + path, init) : await accountFetch(edgeUrl + path, init, false);
  const result = await response.json() as T & { message?: string };
  if ((await currentAccountId()) !== owner) throw new Error("账号已改变，请重试");
  if (!response.ok) throw new Error(typeof result.message === "string" ? result.message : "暂时无法同步，请重试");
  return result;
}
const query = (cursor?: string) => cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
export const readRelations = (id: string, kind: RelationKind, cursor?: string) => request<RelationPage>(`/v1/profiles/${id}/${kind}${query(cursor)}`, undefined, true);
export const readInbox = (cursor?: string) => {
  const before = countRevision;
  return request<InboxPage>(`/v1/messages${query(cursor)}`).then(page => { if (before === countRevision) emitCount(page.unreadCount); return page; });
};
export const readMessages = (id: string, cursor?: string) => request<MessagePage>(`/v1/messages/${id}${query(cursor)}`);
export const sendMessage = (id: string, body: string, requestId: string) => request<{ message: Message }>(`/v1/messages/${id}`, { body, requestId });
export const markMessagesRead = (id: string, through: string) => {
  const before = ++countRevision;
  return request<{ unreadCount: number }>(`/v1/messages/${id}/read`, { through }).then(result => { if (before === countRevision) emitCount(result.unreadCount); return result; });
};
let unread = 0;
let countRevision = 0;
const countListeners = new Set<(value: number) => void>();
const eventListeners = new Set<(type: string) => void>();
function emitCount(value: number) { unread = Math.max(0, value); countListeners.forEach(fn => fn(unread)); }
subscribeAccountIdentity(() => { countRevision++; emitCount(0); });
export function useMessageCount() {
  const [value, setValue] = useState(unread);
  useEffect(() => { countListeners.add(setValue); setValue(unread); return () => { countListeners.delete(setValue); }; }, []);
  return value;
}
export function useInboxVersion(messageOnly = false) {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const listener = (type: string) => { if (!messageOnly || type === "message") setVersion(v => v + 1); };
    eventListeners.add(listener);
    return () => { eventListeners.delete(listener); };
  }, [messageOnly]);
  return version;
}
function syncUnread() {
  const before = countRevision;
  void request<{ unreadCount: number }>("/v1/messages/unread").then(result => { if (before === countRevision) emitCount(result.unreadCount); }).catch(() => {});
}
let reconnect: (() => void) | undefined;
export function reconnectMessages() { reconnect?.(); }
/** Live invalidations contain no private content. Data reads always reauthenticate. */
export function useMessagesSync() {
  const { user } = useAccount();
  useEffect(() => {
    let live = true, socket: WebSocket | undefined, opening = false;
    const connect = async () => {
      if (!user || !live || AppState.currentState !== "active" || opening || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
      opening = true;
      try {
        const next = await accountSocket("/v1/messages/live");
        if (!live || cachedAccountId() !== user.id || AppState.currentState !== "active") { next.close(); return; }
        socket = next;
        next.onopen = () => {
          syncUnread();
          eventListeners.forEach(fn => fn("message")); // Catch up after foreground/reconnect.
        };
        next.onmessage = event => {
          try { const data = JSON.parse(String(event.data)); if (data.type === "message" || data.type === "read") {
            eventListeners.forEach(fn => fn(data.type));
            syncUnread();
          } } catch {}
        };
        next.onerror = () => {};
        next.onclose = event => { if (live && event.code === 1000 && event.reason === "Reconnect") void connect(); };
      } catch {} finally { opening = false; }
    };
    const ensure = () => { void connect(); };
    reconnect = ensure;
    ensure();
    const subscription = AppState.addEventListener("change", state => {
      if (state === "active") ensure();
      else { socket?.close(); socket = undefined; }
    });
    return () => { live = false; socket?.close(); subscription.remove(); if (reconnect === ensure) reconnect = undefined; };
  }, [user?.id]);
}
