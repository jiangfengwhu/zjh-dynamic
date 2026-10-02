import { useEffect, useState } from "react";
import { edgeUrl } from "../evolveHost";
import { accountFetch, currentAccountId, cachedAccountId, subscribeAccountIdentity } from "../account";
import { readShellValue, writeShellValue } from "../shellStorage";

export type ApplicationLink = { appId: string; releaseId: string; title: string; summary: string; mark: string; accent: string };
export type UserPost = { id: string; author: { id: string; name: string; avatarUrl: string | null }; body: string; images: Array<{ id: string; url: string }>; createdAt: number; likeCount?: number; commentCount?: number; liked?: boolean; application?: ApplicationLink };
export type UserComment = { id: string; postId: string; author: UserPost["author"]; body: string; createdAt: number; replyTo?: { id: string; name: string } };
export type PostDetail = { post: UserPost; comments: UserComment[]; nextCursor: string | null };
type Page = { posts: UserPost[]; nextCursor: string | null; reactionOwnerId?: string };
let value: Page = { posts: [], nextCursor: null };
let initialization: Promise<void> | undefined;
let initialized = false;
let revision = 0;
let refreshing: Promise<void> | undefined;
let paging: Promise<void> | undefined;
const listeners = new Set<(page: Page) => void>();
function save(next: Page) { value = { ...next, reactionOwnerId: cachedAccountId() }; writeShellValue("social.timeline.v1", JSON.stringify(value)); listeners.forEach(listener => listener(value)); }
async function initialize() {
  if (!initialization) initialization = (async () => { const owner = await currentAccountId(); const before = revision; const raw = await readShellValue("social.timeline.v1"); try { const cached = raw ? JSON.parse(raw) : null; if (before === revision && Array.isArray(cached?.posts)) { value = { ...cached, posts: cached.posts.map((post: UserPost) => ({ ...post, liked: cached.reactionOwnerId === owner && !!post.liked })), reactionOwnerId: owner }; listeners.forEach(listener => listener(value)); } } catch {} initialized = true; })();
  await initialization;
}
export function useUserPosts() {
  const [page, setPage] = useState(value);
  useEffect(() => { listeners.add(setPage); setPage(value); void initialize(); return () => { listeners.delete(setPage); }; }, []);
  return page;
}
async function requestPage(cursor?: string) {
  return readSocial<Page>(`/v1/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
}
export function refreshUserPosts(): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => { await initialize(); const before = revision; const page = await requestPage(); if (before === revision) { revision++; save(page); } })().finally(() => { refreshing = undefined; });
  return refreshing;
}
export function loadMoreUserPosts(): Promise<void> {
  if (paging) return paging;
  paging = (async () => { const cursor = value.nextCursor; const before = revision; if (!cursor) return; const page = await requestPage(cursor); if (before !== revision || value.nextCursor !== cursor) return; const known = new Set(value.posts.map(post => post.id)); revision++; save({ posts: [...value.posts, ...page.posts.filter(post => !known.has(post.id))], nextCursor: page.nextCursor }); })().finally(() => { paging = undefined; });
  return paging;
}
export async function publishUserPost(body: string, imageIds: string[], requestId: string, application?: { appId: string; releaseId: string }): Promise<void> {
  const response = await accountFetch(`${edgeUrl}/v1/posts`, { method: "POST", signal: AbortSignal.timeout(20000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, imageIds, requestId, application }) }, false);
  const result = await response.json() as { post?: UserPost; message?: string };
  if (!response.ok || !result.post) throw new Error(result.message || "发布未完成，请重试");
  revision++; save({ ...value, posts: [result.post, ...value.posts.filter(post => post.id !== result.post!.id)] });
}
export async function deleteUserPost(id: string): Promise<void> {
  const response = await accountFetch(`${edgeUrl}/v1/posts/${id}`, { method: "DELETE", signal: AbortSignal.timeout(20000) }, false);
  if (!response.ok) { const result = await response.json() as { message?: string }; throw new Error(result.message || "删除未完成，请重试"); }
  revision++; save({ ...value, posts: value.posts.filter(post => post.id !== id) });
}

async function readSocial<T>(path: string, options?: RequestInit): Promise<T> {
  const owner = await currentAccountId();
  const init = { ...options, signal: AbortSignal.timeout(15000) };
  const response = owner ? await accountFetch(`${edgeUrl}${path}`, init, false) : await fetch(`${edgeUrl}${path}`, init);
  const result = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(result.message || "互动暂时未完成，请重试");
  if (await currentAccountId() !== owner) throw new Error("账号已改变，请重试");
  return result;
}
export function updateUserPost(post: UserPost) { revision++; save({ ...value, posts: value.posts.map(item => item.id === post.id ? post : item) }); }
export async function fetchPostDetail(id: string, cursor?: string): Promise<PostDetail> { return readSocial<PostDetail>(`/v1/posts/${id}${cursor ? `/comments?cursor=${encodeURIComponent(cursor)}` : ""}`); }
export async function setPostLike(id: string, liked: boolean) {
  const result = await readSocial<{ post: UserPost }>(`/v1/posts/${id}/like`, { method: liked ? "POST" : "DELETE" }); updateUserPost(result.post);
}
export async function publishPostComment(id: string, body: string, requestId: string, replyTo?: string) {
  const result = await readSocial<{ comment: UserComment; post: UserPost }>(`/v1/posts/${id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, requestId, replyTo }) }); updateUserPost(result.post); return result;
}
export async function deletePostComment(id: string, commentId: string) {
  const result = await readSocial<{ post: UserPost }>(`/v1/posts/${id}/comments/${commentId}`, { method: "DELETE" }); updateUserPost(result.post); return result;
}
subscribeAccountIdentity(() => {
  revision++; const next = { ...value, reactionOwnerId: cachedAccountId(), posts: value.posts.map(post => ({ ...post, liked: false })) };
  if (initialized) save(next); else { value = next; listeners.forEach(listener => listener(value)); }
  void Promise.resolve(refreshing).catch(() => {}).then(() => refreshUserPosts()).catch(() => {});
});
