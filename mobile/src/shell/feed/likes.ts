import { readPackageValue, subscribePackageValue, writePackageValue } from "../../../../components/packageLink";

const KEY = "feed.likes.v1";
const LIMIT = 400;

/** 点过喜欢的帖子 id，新的排在最后。 */
export function readLikes(): string[] {
  const raw = readPackageValue(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch (error) {
    console.log("feed likes unreadable", error instanceof Error ? error.message : error);
    return [];
  }
}

export function toggleLike(postId: string): boolean {
  const current = readLikes();
  const liked = current.includes(postId);
  const next = liked ? current.filter((item) => item !== postId) : [...current, postId].slice(-LIMIT);
  writePackageValue(KEY, JSON.stringify(next));
  return !liked;
}

export function subscribeLikes(listener: (likes: string[]) => void): () => void {
  listener(readLikes());
  return subscribePackageValue(KEY, () => listener(readLikes()));
}
