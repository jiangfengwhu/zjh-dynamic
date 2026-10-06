import { cachedAccountId } from "./account";
import { readShellValueSync, writeShellValue, removeShellValue, shellKeys } from "./shellStorage";
import { applicationQueryClient } from "../../../../packages/app-sdk/src/query-runtime";
const prefix = "shell.page-cache.v1.";
export function pageCacheKey(key: string) { return `${cachedAccountId() ?? "guest"}:${key}`; }
export function cachedPage<T>(key: string): T | undefined {
  const client = applicationQueryClient("__host");
  const cached = client.getQueryData<T>(["page", key]);
  if (cached !== undefined) return cached;
  try {
    const raw = readShellValueSync(prefix + key);
    if (!raw) return undefined;
    const value = JSON.parse(raw).value as T;
    client.setQueryData(["page", key], value);
    return value;
  } catch { return undefined; }
}
export function rememberPage<T>(key: string, value: T) {
  const client = applicationQueryClient("__host");
  const remembered = client.setQueryData(["page", key], value);
  const entries = client.getQueryCache().findAll({ queryKey: ["page"] }).sort((a,b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);
  while (entries.length > 32) client.removeQueries({ queryKey: entries.shift()!.queryKey, exact: true });
  // Persistence follows the visible response; coalesce rapid local mutations.
  requestIdleCallback(() => {
    if (client.getQueryData(["page", key]) !== remembered) return;
    writeShellValue(prefix + key, JSON.stringify({ value }));
    const keys = shellKeys().filter(item => item.startsWith(prefix) && item !== prefix + key);
    while (keys.length >= 32) removeShellValue(keys.shift()!);
  });
}
export function forgetPage(key: string) { applicationQueryClient("__host").removeQueries({ queryKey: ["page", key], exact: true }); removeShellValue(prefix + key); }
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
  for (const stored of shellKeys()) if (stored.startsWith(prefix + key)) removeShellValue(stored);
}
