import { encodePageSnapshot, decodePageSnapshot } from "./pageSnapshot";
import { afterInteractions } from "./interactionWork";
import { cachedAccountId } from "./account";
import { readShellValueSync, writeShellValue, removeShellValue, shellKeys } from "./shellStorage";
import { applicationQueryClient } from "../../../../packages/app-sdk/src/query-runtime";
const prefix = "shell.page-cache.v1.";
const partPrefix = "shell.page-parts.v2.";
const partsKey = (key: string) => partPrefix + encodeURIComponent(key) + ".";
const writes = new Map<string, () => void>();
function removeSnapshot(key: string) {
  removeShellValue(prefix + key);
  for (const part of shellKeys()) if (part.startsWith(partsKey(key))) removeShellValue(part);
}
export function pageCacheKey(key: string) { return `${cachedAccountId() ?? "guest"}:${key}`; }
export function cachedPage<T>(key: string): T | undefined {
  const client = applicationQueryClient("__host");
  const cached = client.getQueryData<T>(["page", key]);
  if (cached !== undefined) return cached;
  try {
    const raw = readShellValueSync(prefix + key);
    if (!raw) return undefined;
    const value = decodePageSnapshot(raw, part => readShellValueSync(partsKey(key) + part)) as T;
    client.setQueryData(["page", key], value);
    return value;
  } catch { return undefined; }
}
export function rememberPage<T>(key: string, value: T) {
  const client = applicationQueryClient("__host");
  const previous = client.getQueryData<T>(["page", key]);
  const remembered = client.setQueryData(["page", key], value);
  if (remembered === previous) return remembered ?? value;
  const entries = client.getQueryCache().findAll({ queryKey: ["page"] }).sort((a,b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);
  while (entries.length > 32) client.removeQueries({ queryKey: entries.shift()!.queryKey, exact: true });
  // Coalesce mutations; only changed, bounded page chunks are written after response.
  writes.get(key)?.();
  writes.set(key, afterInteractions(() => {
    writes.delete(key);
    if (client.getQueryData(["page", key]) !== remembered) return;
    const snapshot = encodePageSnapshot(remembered);
    if (!snapshot) { removeSnapshot(key); return; }
    const retained = new Set<string>();
    for (const [part, raw] of Object.entries(snapshot.pages)) {
      const name = partsKey(key) + part; retained.add(name);
      if (readShellValueSync(name) !== raw) writeShellValue(name, raw);
    }
    for (const name of shellKeys()) if (name.startsWith(partsKey(key)) && !retained.has(name)) removeShellValue(name);
    writeShellValue(prefix + key, snapshot.header);
    const keys = shellKeys().filter(item => item.startsWith(prefix) && item !== prefix + key);
    while (keys.length >= 32) removeSnapshot(keys.shift()!.slice(prefix.length));
  }));
  return remembered ?? value;
}
export function dataChanged(a: unknown, b: unknown, metadataKeys: string[] = []) {
  const serialize = (value: unknown) => JSON.stringify(value, (key, item) => {
    if (metadataKeys.includes(key)) return undefined;
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.fromEntries(Object.keys(item).sort().map(name => [name, item[name]]));
    }
    return item;
  });
  return serialize(a) !== serialize(b);
}

export function forgetPageFamily(key: string) {
  applicationQueryClient("__host").removeQueries({ queryKey: ["page"], predicate: query => String(query.queryKey[1]).startsWith(key) });
  for (const [pending, cancel] of writes) if (pending.startsWith(key)) { cancel(); writes.delete(pending); }
  for (const stored of shellKeys()) if (stored.startsWith(prefix + key)) removeSnapshot(stored.slice(prefix.length));
}
