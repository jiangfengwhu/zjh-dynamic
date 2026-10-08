import { waitForInteractions } from "../interactionWork";
import { cachedPage, rememberPage, forgetPageFamily, pageCacheKey } from "../pageCache";
import { useEffect, useState } from "react";
import { edgeUrl } from "../evolveHost";
import {
  accountFetch,
  currentAccountId,
  cachedAccountId,
  subscribeAccountIdentity,
} from "../account";
import { removeShellValue } from "../shellStorage";
import type { MarketApplication } from "../market";
import { updateNotificationCount, notificationRevision } from "./notifications";

export type ApplicationLink = {
  iconUrl?: string;
  icon?: import("../../../../../packages/app-sdk/src").ApplicationManifest["icon"];
  appId: string;
  releaseId: string;
  title: string;
  summary: string;
  accent: string;
};
export type PostContent = { format: "html"; version: 1; html: string };
export type UserPost = {
  id: string;
  author: { id: string; name: string; avatarUrl: string | null };
  body: string;
  images: Array<{ id: string; url: string }>;
  createdAt: number;
  viewCount?: number;
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
const authorProfiles = new Map<string, AuthorProfile>();
const authorFlights = new Map<string, Promise<AuthorProfile>>();
function profileKey(id: string) { return `${cachedAccountId() ?? "guest"}:${id}`; }
export function cachedAuthorProfile(id: string) { return authorProfiles.get(profileKey(id)) ?? cachedPage<AuthorProfile>(pageCacheKey(`author:${id}`)); }
export function fetchAuthorProfile(id: string) {
  const key = profileKey(id);
  const existing = authorFlights.get(key);
  if (existing) return existing;
  const promise = readSocial<AuthorProfile>(`/v1/profiles/${id}`).then(profile => {
    if (profileKey(id) === key) {
      authorProfiles.delete(key);
      authorProfiles.set(key, profile);
      rememberPage(pageCacheKey(`author:${id}`), profile);
      if (authorProfiles.size > 12) authorProfiles.delete(authorProfiles.keys().next().value!);
    }
    return profile;
  }).finally(() => { if (authorFlights.get(key) === promise) authorFlights.delete(key); });
  authorFlights.set(key, promise);
  return promise;
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
  loaded?: boolean;
  at?: number;
  pending?: Page;
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
let value: Page = cachedPage<Page>(pageCacheKey("feed:recommended")) ?? { posts: [], nextCursor: null };
// The account-scoped page cache is the only timeline snapshot. Retire the
// duplicate legacy snapshot without reading/parsing it during startup.
requestIdleCallback(() => removeShellValue("social.timeline.v1"));
let revision = 0;
let refreshing: Promise<void> | undefined;
let manualRefreshRequested = false;
let paging: Promise<void> | undefined;
const listeners = new Set<(page: Page) => void>();
function save(next: Page) {
  const previous = value;
  value = rememberPage(pageCacheKey("feed:recommended"), { ...next, posts: next.posts.map(withPendingLike), reactionOwnerId: cachedAccountId() });
  if (value === previous) return;
  listeners.forEach((listener) => listener(value));
}
export type FeedScope = "recommended" | "following";
let followingPage: Page = { posts: [], nextCursor: null };
let followingCacheInitialized = false;
function restoreFollowingPage() {
  if (!followingCacheInitialized) {
    followingCacheInitialized = true;
    followingPage = cachedPage<Page>(pageCacheKey("feed:following")) ?? followingPage;
  }
  return followingPage;
}
let followingRevision = 0;
let followingRefresh: Promise<void> | undefined;
let followingManualRefreshRequested = false;
let followingPaging: Promise<void> | undefined;
export function userPostsLoaded(scope: FeedScope) {
  return !!(scope === "following" ? followingPage : value).loaded;
}
export function shouldRefreshUserPosts(scope: FeedScope) {
  const page = scope === "following" ? followingPage : value;
  return !page.loaded || !page.at || Date.now() - page.at > 60000;
}
const followingListeners = new Set<(page: Page) => void>();
function saveFollowing(page: Page) {
  followingCacheInitialized = true;
  const previous = followingPage;
  followingPage = rememberPage(pageCacheKey("feed:following"), { ...page, posts: page.posts.map(withPendingLike) });
  if (followingPage === previous) return;
  followingListeners.forEach((listener) => listener(followingPage));
}

function refreshedPage(current: Page, page: Page, silent: boolean): Page {
  const next = { ...page, loaded: true, at: Date.now() };
  if (!silent || !current.loaded) return next;
  const changedOrder = page.posts.some((post, index) => post.id !== current.posts[index]?.id)
    || !page.nextCursor && page.posts.length !== current.posts.length;
  if (changedOrder) return { ...current, at: next.at, pending: next };
  const incoming = new Map(page.posts.map(post => [post.id, post]));
  return { ...next, posts: current.posts.map(post => incoming.get(post.id) ?? post) };
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
    if (!followingListeners.size) return;
    void Promise.resolve(followingRefresh)
      .catch(() => {})
      .then(() => followingListeners.size ? refreshFollowing() : undefined)
      .catch(() => {});
  });
  return result;
}
async function refreshFollowing(silent = false) {
  restoreFollowingPage();
  if (!silent) {
    followingManualRefreshRequested = true;
    if (followingPage.pending) saveFollowing({ ...followingPage, pending: undefined });
  }
  if (followingRefresh) return followingRefresh;
  followingRefresh = (async () => {
    const before = followingRevision;
    const countBefore = notificationRevision();
    const page = await readSocial<Page>("/v1/posts?feed=following");
    await waitForInteractions();
    if (before === followingRevision && page.unreadCount !== undefined)
      updateNotificationCount(page.unreadCount, countBefore);
    if (before === followingRevision) {
      followingRevision++;
      saveFollowing(refreshedPage(followingPage, page, silent && !followingManualRefreshRequested));
    }
  })().finally(() => {
    followingRefresh = undefined;
    followingManualRefreshRequested = false;
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
      ...followingPage,
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
export function useUserPosts(scope: FeedScope = "recommended", active = true) {
  const [following, setFollowing] = useState(() => ({
    owner: cachedAccountId(),
    page: scope === "following" && active ? restoreFollowingPage() : followingPage,
  }));
  useEffect(() => {
    if (scope !== "following" || !active) return;
    const update = (page: Page) => setFollowing({ owner: cachedAccountId(), page });
    followingListeners.add(update);
    update(restoreFollowingPage());
    return () => {
      followingListeners.delete(update);
    };
  }, [scope, active]);
  const [page, setPage] = useState(value);
  useEffect(() => {
    if (scope === "following") return;
    listeners.add(setPage);
    setPage(value);
    void currentAccountId();
    return () => {
      listeners.delete(setPage);
    };
  }, [scope]);
  return scope === "following"
    ? following.owner === cachedAccountId() ? following.page : { posts: [], nextCursor: null } as Page
    : page;
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
  scope: FeedScope = "recommended",
  silent = false
): Promise<void> {
  if (scope === "following") return refreshFollowing(silent);
  if (!silent) {
    manualRefreshRequested = true;
    if (value.pending) save({ ...value, pending: undefined });
  }
  if (refreshing) return refreshing;
  refreshing = (async () => {
    await currentAccountId();
    const before = revision;
    const page = await requestPage();
    await waitForInteractions();
    if (before === revision) {
      revision++;
      save(refreshedPage(value, page, silent && !manualRefreshRequested));
    }
  })().finally(() => {
    refreshing = undefined;
    manualRefreshRequested = false;
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
      ...value,
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
    pending: undefined,
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
  forgetPageFamily(pageCacheKey(`post:${id}:`));
  revision++;
  save({ ...value, pending: undefined, posts: value.posts.filter((post) => post.id !== id) });
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
    pending: followingPage.pending ? { ...followingPage.pending, posts: followingPage.pending.posts.map(item => item.id === post.id ? post : item) } : undefined,
  });
  revision++;
  save({
    ...value,
    posts: value.posts.map((item) => (item.id === post.id ? post : item)),
    pending: value.pending ? { ...value.pending, posts: value.pending.posts.map(item => item.id === post.id ? post : item) } : undefined,
  });
}
export async function fetchPostDetail(
  id: string,
  cursor?: string,
  commentId?: string
): Promise<PostDetail> {
  const key = pageCacheKey(`post:${id}:${commentId ?? ""}`);
  const result = await readSocial<PostDetail>(
    `/v1/posts/${id}${
      cursor
        ? `/comments?cursor=${encodeURIComponent(cursor)}`
        : commentId
        ? `?commentId=${encodeURIComponent(commentId)}`
        : ""
    }`
  );
  if (!cursor && key === pageCacheKey(`post:${id}:${commentId ?? ""}`)) rememberPage(key, result);
  return result;
}
export function cachedPostDetail(id: string, commentId?: string) { return cachedPage<PostDetail>(pageCacheKey(`post:${id}:${commentId ?? ""}`)); }
export function acceptUserPosts(scope: FeedScope) {
  const page = scope === "following" ? followingPage : value;
  if (!page.pending) return;
  if (scope === "following") { followingRevision++; saveFollowing(page.pending); }
  else { revision++; save(page.pending); }
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
  forgetPageFamily(pageCacheKey(`post:${id}:`));
  updateUserPost(result.post);
  return result;
}
export async function deletePostComment(id: string, commentId: string) {
  const result = await readSocial<{ post: UserPost }>(
    `/v1/posts/${id}/comments/${commentId}`,
    { method: "DELETE" }
  );
  forgetPageFamily(pageCacheKey(`post:${id}:`));
  updateUserPost(result.post);
  return result;
}
subscribeAccountIdentity(() => {
  authorProfiles.clear();
  authorFlights.clear();
  pendingLikes.clear();
  followingRevision++;
  followingCacheInitialized = false;
  followingPage = { posts: [], nextCursor: null };
  followingListeners.forEach(listener => listener(followingPage));
  if (followingListeners.size) {
    void Promise.resolve(followingRefresh)
      .catch(() => {})
      .then(() => followingListeners.size ? refreshFollowing() : undefined)
      .catch(() => {});
  }
  revision++;
  value = cachedPage<Page>(pageCacheKey("feed:recommended")) ?? { posts: [], nextCursor: null };
  listeners.forEach((listener) => listener(value));
  void Promise.resolve(refreshing)
    .catch(() => {})
    .then(() => refreshUserPosts())
    .catch(() => {});
});
