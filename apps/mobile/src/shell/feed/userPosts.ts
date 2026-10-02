import { useEffect, useState } from "react";
import { edgeUrl } from "../evolveHost";
import { accountFetch } from "../account";
import { readShellValue, writeShellValue } from "../shellStorage";

export type UserPost = { id: string; author: { id: string; name: string; avatarUrl: string | null }; body: string; images: Array<{ id: string; url: string }>; createdAt: number };
type Page = { posts: UserPost[]; nextCursor: string | null };
let value: Page = { posts: [], nextCursor: null };
let initialization: Promise<void> | undefined;
let revision = 0;
let refreshing: Promise<void> | undefined;
let paging: Promise<void> | undefined;
const listeners = new Set<(page: Page) => void>();
function save(next: Page) { value = next; writeShellValue("social.timeline.v1", JSON.stringify(next)); listeners.forEach(listener => listener(next)); }
async function initialize() {
  if (!initialization) initialization = (async () => { const before = revision; const raw = await readShellValue("social.timeline.v1"); try { const cached = raw ? JSON.parse(raw) : null; if (before === revision && Array.isArray(cached?.posts)) { value = cached; listeners.forEach(listener => listener(value)); } } catch {} })();
  await initialization;
}
export function useUserPosts() {
  const [page, setPage] = useState(value);
  useEffect(() => { listeners.add(setPage); setPage(value); void initialize(); return () => { listeners.delete(setPage); }; }, []);
  return page;
}
async function requestPage(cursor?: string) {
  const response = await fetch(`${edgeUrl}/v1/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { signal: AbortSignal.timeout(12000) });
  const result = await response.json() as Page & { message?: string };
  if (!response.ok) throw new Error(result.message || "动态暂时无法刷新");
  return result;
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
export async function publishUserPost(body: string, imageIds: string[], requestId: string): Promise<void> {
  const response = await accountFetch(`${edgeUrl}/v1/posts`, { method: "POST", signal: AbortSignal.timeout(20000), headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, imageIds, requestId }) }, false);
  const result = await response.json() as { post?: UserPost; message?: string };
  if (!response.ok || !result.post) throw new Error(result.message || "发布未完成，请重试");
  revision++; save({ ...value, posts: [result.post, ...value.posts.filter(post => post.id !== result.post!.id)] });
}
export async function deleteUserPost(id: string): Promise<void> {
  const response = await accountFetch(`${edgeUrl}/v1/posts/${id}`, { method: "DELETE", signal: AbortSignal.timeout(20000) }, false);
  if (!response.ok) { const result = await response.json() as { message?: string }; throw new Error(result.message || "删除未完成，请重试"); }
  revision++; save({ ...value, posts: value.posts.filter(post => post.id !== id) });
}
