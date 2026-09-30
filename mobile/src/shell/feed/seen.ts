import { readPackageValue, subscribePackageValue, writePackageValue } from "../../../../components/packageLink";

const KEY = "feed.seen.v1";

/** 每位朋友「我看到哪一刻为止」。比这更新的帖子算未读。 */
export type SeenMap = Record<string, number>;

export function readSeen(): SeenMap {
  const raw = readPackageValue(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: SeenMap = {};
    for (const [appId, at] of Object.entries(parsed)) {
      if (typeof at === "number" && Number.isFinite(at)) result[appId] = at;
    }
    return result;
  } catch (error) {
    console.log("feed seen unreadable", error instanceof Error ? error.message : error);
    return {};
  }
}

export function markSeen(appId: string, at: number = Date.now()) {
  const seen = readSeen();
  if ((seen[appId] ?? 0) >= at) return;
  writePackageValue(KEY, JSON.stringify({ ...seen, [appId]: at }));
}

export function subscribeSeen(listener: (seen: SeenMap) => void): () => void {
  listener(readSeen());
  return subscribePackageValue(KEY, () => listener(readSeen()));
}
