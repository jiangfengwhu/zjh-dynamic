import { useEffect, useState } from "react";
import { edgeUrl } from "../evolveHost";
import {
  accountFetch,
  currentAccountId,
  cachedAccountId,
  subscribeAccountIdentity,
} from "../account";
import { readShellValue, writeShellValue } from "../shellStorage";
import type { MarketApplication } from "../market";
import { updateNotificationCount, notificationRevision } from "./notifications";

export type ApplicationLink = {
  appId: string;
  releaseId: string;
  title: string;
  summary: string;
  mark: string;
  accent: string;
};
export type PostContent = { format: "html"; version: 1; html: string };
export type UserPost = {
  id: string;
  author: { id: string; name: string; avatarUrl: string | null };
  body: string;
  images: Array<{ id: string; url: string }>;
  createdAt: number;
  likeCount?: number;
  commentCount?: number;
  liked?: boolean;
  application?: ApplicationLink;
  content?: PostContent;
};
export type UserComment = {
  id: string;
  postId: string;
  author: UserPost["author"];
  body: string;
  createdAt: number;
  replyTo?: { id: string; name: string };
};
export type PostDetail = {
  post: UserPost;
  comments: UserComment[];
  nextCursor: string | null;
};
export type PublicAuthor = UserPost["author"] & { official?: boolean };
export type AuthorProfile = {
  following?: boolean;
  followerCount?: number;
  followingCount?: number;
  author: PublicAuthor;
  posts: UserPost[];
  applications: MarketApplication[];
  nextCursor: string | null;
};
export function fetchAuthorProfile(id: string) {
  return readSocial<AuthorProfile>(`/v1/profiles/${id}`);
}
export function fetchAuthorPosts(id: string, cursor: string) {
  return readSocial<{ posts: UserPost[]; nextCursor: string | null }>(
    `/v1/posts?authorId=${id}&cursor=${encodeURIComponent(cursor)}`
  );
}
type Page = {
  posts: UserPost[];
  nextCursor: string | null;
  reactionOwnerId?: string;
  unreadCount?: number;
};
type LikeSettlement = { post: UserPost; error?: unknown };
type PendingLike = {
  owner: string;
  confirmed: UserPost;
  desired: boolean;
  optimistic: UserPost;
  settled: Promise<LikeSettlement>;
};
const pendingLikes = new Map<string, PendingLike>();
function withPendingLike(post: UserPost): UserPost {
  const pending = pendingLikes.get(post.id);
  return pending && pending.owner === cachedAccountId()
    ? { ...post, liked: pending.optimistic.liked, likeCount: pending.optimistic.likeCount }
    : post;
}
let value: Page = { posts: [], nextCursor: null };
let initialization: Promise<void> | undefined;
let initialized = false;
let revision = 0;
let refreshing: Promise<void> | undefined;
let paging: Promise<void> | undefined;
const listeners = new Set<(page: Page) => void>();
function save(next: Page) {
  value = { ...next, posts: next.posts.map(withPendingLike), reactionOwnerId: cachedAccountId() };
  writeShellValue("social.timeline.v1", JSON.stringify(value));
  listeners.forEach((listener) => listener(value));
}
async function initialize() {
  if (!initialization)
    initialization = (async () => {
      const owner = await currentAccountId();
      const before = revision;
      const raw = await readShellValue("social.timeline.v1");
      try {
        const cached = raw ? JSON.parse(raw) : null;
        if (before === revision && Array.isArray(cached?.posts)) {
          value = {
            ...cached,
            posts: cached.posts.map((post: UserPost) => withPendingLike({
              ...post,
              liked: cached.reactionOwnerId === owner && !!post.liked,
            })),
            reactionOwnerId: owner,
          };
          listeners.forEach((listener) => listener(value));
        }
      } catch {}
      initialized = true;
    })();
  await initialization;
}
export type FeedScope = "recommended" | "following";
let followingPage: Page = { posts: [], nextCursor: null };
let followingRevision = 0;
let followingRefresh: Promise<void> | undefined;
let followingPaging: Promise<void> | undefined;
const followingListeners = new Set<(page: Page) => void>();
function saveFollowing(page: Page) {
  followingPage = { ...page, posts: page.posts.map(withPendingLike) };
  followingListeners.forEach((listener) => listener(followingPage));
}
export async function setAuthorFollow(id: string, following: boolean) {
  const result = await readSocial<{
    following: boolean;
    followerCount: number;
    followingCount: number;
  }>(`/v1/profiles/${id}/follow`, { method: following ? "POST" : "DELETE" });
  followingRevision++;
  if (!following)
    saveFollowing({
      ...followingPage,
      posts: followingPage.posts.filter((post) => post.author.id !== id),
    });
  // Let the button response render before fetching the updated timeline.
  requestIdleCallback(() => {
    void Promise.resolve(followingRefresh)
      .catch(() => {})
      .then(() => refreshFollowing())
      .catch(() => {});
  });
  return result;
}
async function refreshFollowing() {
  if (followingRefresh) return followingRefresh;
  followingRefresh = (async () => {
    const before = followingRevision;
    const page = await readSocial<Page>("/v1/posts?feed=following");
    if (before === followingRevision) {
      followingRevision++;
      saveFollowing(page);
    }
  })().finally(() => {
    followingRefresh = undefined;
  });
  return followingRefresh;
}
async function loadMoreFollowing() {
  if (followingPaging) return followingPaging;
  followingPaging = (async () => {
    const cursor = followingPage.nextCursor;
    const before = followingRevision;
    if (!cursor) return;
    const page = await readSocial<Page>(
      `/v1/posts?feed=following&cursor=${encodeURIComponent(cursor)}`
    );
    if (before !== followingRevision || followingPage.nextCursor !== cursor)
      return;
    const known = new Set(followingPage.posts.map((post) => post.id));
    followingRevision++;
    saveFollowing({
      posts: [
        ...followingPage.posts,
        ...page.posts.filter((post) => !known.has(post.id)),
      ],
      nextCursor: page.nextCursor,
    });
  })().finally(() => {
    followingPaging = undefined;
  });
  return followingPaging;
}
export function useUserPosts(scope: FeedScope = "recommended") {
  const [following, setFollowing] = useState(followingPage);
  useEffect(() => {
    if (scope !== "following") return;
    followingListeners.add(setFollowing);
    setFollowing(followingPage);
    return () => {
      followingListeners.delete(setFollowing);
    };
  }, [scope]);
  const [page, setPage] = useState(value);
  useEffect(() => {
    if (scope === "following") return;
    listeners.add(setPage);
    setPage(value);
    void initialize();
    return () => {
      listeners.delete(setPage);
    };
  }, [scope]);
  return scope === "following" ? following : page;
}
async function requestPage(cursor?: string) {
  const before = notificationRevision();
  const page = await readSocial<Page>(
    `/v1/posts${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`
  );
  if (page.unreadCount !== undefined)
    updateNotificationCount(page.unreadCount, before);
  return page;
}
export function refreshUserPosts(
  scope: FeedScope = "recommended"
): Promise<void> {
  if (scope === "following") return refreshFollowing();
  if (refreshing) return refreshing;
  refreshing = (async () => {
    await initialize();
    const before = revision;
    const page = await requestPage();
    if (before === revision) {
      revision++;
      save(page);
    }
  })().finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}
export function loadMoreUserPosts(
  scope: FeedScope = "recommended"
): Promise<void> {
  if (scope === "following") return loadMoreFollowing();
  if (paging) return paging;
  paging = (async () => {
    const cursor = value.nextCursor;
    const before = revision;
    if (!cursor) return;
    const page = await requestPage(cursor);
    if (before !== revision || value.nextCursor !== cursor) return;
    const known = new Set(value.posts.map((post) => post.id));
    revision++;
    save({
      posts: [
        ...value.posts,
        ...page.posts.filter((post) => !known.has(post.id)),
      ],
      nextCursor: page.nextCursor,
    });
  })().finally(() => {
    paging = undefined;
  });
  return paging;
}
export async function publishUserPost(
  body: string,
  imageIds: string[],
  requestId: string,
  application?: { appId: string; releaseId: string },
  content?: PostContent
): Promise<UserPost> {
  const owner = await currentAccountId();
  if (!owner) throw new Error("请先登录后发布");
  const response = await accountFetch(
    `${edgeUrl}/v1/posts`,
    {
      method: "POST",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, imageIds, requestId, application, content }),
    },
    false
  );
  const result = (await response.json()) as {
    post?: UserPost;
    message?: string;
  };
  if (!response.ok || !result.post)
    throw new Error(result.message || "发布未完成，请重试");
  if ((await currentAccountId()) !== owner)
    throw new Error("账号已改变，请切回原账号查看发布结果");
  revision++;
  save({
    ...value,
    posts: [
      result.post,
      ...value.posts.filter((post) => post.id !== result.post!.id),
    ],
  });
  return result.post;
}
export async function deleteUserPost(id: string): Promise<void> {
  const owner = await currentAccountId();
  if (!owner) throw new Error("请先登录后删除");
  const response = await accountFetch(
    `${edgeUrl}/v1/posts/${id}`,
    { method: "DELETE", signal: AbortSignal.timeout(20000) },
    false
  );
  if (!response.ok) {
    const result = (await response.json()) as { message?: string };
    throw new Error(result.message || "删除未完成，请重试");
  }
  if ((await currentAccountId()) !== owner)
    throw new Error("账号已改变，请重新查看动态");
  revision++;
  save({ ...value, posts: value.posts.filter((post) => post.id !== id) });
  followingRevision++;
  saveFollowing({
    ...followingPage,
    posts: followingPage.posts.filter((post) => post.id !== id),
  });
}

async function readSocial<T>(path: string, options?: RequestInit): Promise<T> {
  const owner = await currentAccountId();
  const init = { ...options, signal: AbortSignal.timeout(15000) };
  const response = owner
    ? await accountFetch(`${edgeUrl}${path}`, init, false)
    : await fetch(`${edgeUrl}${path}`, init);
  const result = (await response.json()) as T & { message?: string };
  if (!response.ok) throw new Error(result.message || "互动暂时未完成，请重试");
  if ((await currentAccountId()) !== owner)
    throw new Error("账号已改变，请重试");
  return result;
}
export function updateUserPost(post: UserPost) {
  followingRevision++;
  saveFollowing({
    ...followingPage,
    posts: followingPage.posts.map((item) =>
      item.id === post.id ? post : item
    ),
  });
  revision++;
  save({
    ...value,
    posts: value.posts.map((item) => (item.id === post.id ? post : item)),
  });
}
export async function fetchPostDetail(
  id: string,
  cursor?: string,
  commentId?: string
): Promise<PostDetail> {
  return readSocial<PostDetail>(
    `/v1/posts/${id}${
      cursor
        ? `/comments?cursor=${encodeURIComponent(cursor)}`
        : commentId
        ? `?commentId=${encodeURIComponent(commentId)}`
        : ""
    }`
  );
}
// Every tap updates the UI first. A single worker per post serializes requests,
// keeping the newest intent visible even when an older response arrives.
export function togglePostLike(post: UserPost) {
  const owner = cachedAccountId();
  if (!owner) throw new Error("请先登录");
  let pending = pendingLikes.get(post.id);
  const starting = pending?.owner !== owner;
  if (pending?.owner === owner) {
    pending.desired = !pending.desired;
  } else {
    pending = {
      owner, confirmed: post, desired: !post.liked, optimistic: post,
      settled: Promise.resolve({ post }),
    };
    pendingLikes.set(post.id, pending);
  }
  const entry = pending;
  const current = () => value.posts.find(item => item.id === post.id)
    ?? followingPage.posts.find(item => item.id === post.id) ?? entry.optimistic;
  const project = () => ({
    ...current(), liked: entry.desired,
    likeCount: Math.max(0, (entry.confirmed.likeCount ?? 0)
      + Number(entry.desired) - Number(!!entry.confirmed.liked)),
  });
  entry.optimistic = project();
  updateUserPost(entry.optimistic);
  if (starting) entry.settled = (async (): Promise<LikeSettlement> => {
    try {
      while (!!entry.confirmed.liked !== entry.desired) {
        const wanted = entry.desired;
        const result = await readSocial<{ post: UserPost }>(`/v1/posts/${post.id}/like`, {
          method: wanted ? "POST" : "DELETE",
        });
        if (cachedAccountId() !== owner || pendingLikes.get(post.id) !== entry)
          return { post: entry.optimistic };
        entry.confirmed = result.post;
        entry.optimistic = project();
        updateUserPost(entry.optimistic);
      }
      pendingLikes.delete(post.id);
      return { post: entry.optimistic };
    } catch (error) {
      if (cachedAccountId() !== owner || pendingLikes.get(post.id) !== entry)
        return { post: entry.optimistic };
      const rollback = { ...current(), liked: !!entry.confirmed.liked, likeCount: entry.confirmed.likeCount };
      pendingLikes.delete(post.id);
      updateUserPost(rollback);
      return { post: rollback, error };
    }
  })();
  return { post: entry.optimistic, settled: entry.settled };
}
export async function publishPostComment(
  id: string,
  body: string,
  requestId: string,
  replyTo?: string
) {
  const result = await readSocial<{ comment: UserComment; post: UserPost }>(
    `/v1/posts/${id}/comments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, requestId, replyTo }),
    }
  );
  updateUserPost(result.post);
  return result;
}
export async function deletePostComment(id: string, commentId: string) {
  const result = await readSocial<{ post: UserPost }>(
    `/v1/posts/${id}/comments/${commentId}`,
    { method: "DELETE" }
  );
  updateUserPost(result.post);
  return result;
}
subscribeAccountIdentity(() => {
  pendingLikes.clear();
  followingRevision++;
  saveFollowing({ posts: [], nextCursor: null });
  void Promise.resolve(followingRefresh)
    .catch(() => {})
    .then(() => refreshFollowing())
    .catch(() => {});
  revision++;
  const next = {
    ...value,
    reactionOwnerId: cachedAccountId(),
    posts: value.posts.map((post) => ({ ...post, liked: false })),
  };
  if (initialized) save(next);
  else {
    value = next;
    listeners.forEach((listener) => listener(value));
  }
  void Promise.resolve(refreshing)
    .catch(() => {})
    .then(() => refreshUserPosts())
    .catch(() => {});
});
