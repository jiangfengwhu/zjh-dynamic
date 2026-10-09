/** Preserve existing row identities and deduplicate a page in linear time. */
export function appendUnique<T>(previous: T[], incoming: T[], key: (item: T) => string): T[] {
  const known = new Set(previous.map(key));
  const added: T[] = [];
  for (const item of incoming) { const id = key(item); if (!known.has(id)) { known.add(id); added.push(item); } }
  return added.length ? [...previous, ...added] : previous;
}
export function chronological(a: {createdAt: number; id: string}, b: {createdAt: number; id: string}) { return a.createdAt - b.createdAt || a.id.localeCompare(b.id); }
/** Only sort the incoming page, then merge with the already ordered history. */
export function mergeChronological<T extends {createdAt: number; id: string}>(previous: T[], incoming: T[]): T[] {
  if (!incoming.length) return previous;
  const replacements = new Map(incoming.map(item => [item.id, item]));
  const old = previous.filter(item => !replacements.has(item.id));
  const next = [...replacements.values()].sort(chronological);
  const merged: T[] = []; let a = 0, b = 0;
  while (a < old.length && b < next.length) merged.push(chronological(old[a], next[b]) <= 0 ? old[a++] : next[b++]);
  return [...merged, ...old.slice(a), ...next.slice(b)];
}
