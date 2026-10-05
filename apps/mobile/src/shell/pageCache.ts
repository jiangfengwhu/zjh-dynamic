import { cachedAccountId } from "./account";
import { readShellValueSync, writeShellValue, removeShellValue, shellKeys } from "./shellStorage";
const memory = new Map<string, unknown>();
const prefix = "shell.page-cache.v1.";
export function pageCacheKey(key: string) { return `${cachedAccountId() ?? "guest"}:${key}`; }
export function cachedPage<T>(key: string): T | undefined {
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = readShellValueSync(prefix + key);
    if (!raw) return undefined;
    const value = JSON.parse(raw).value as T;
    memory.set(key, value);
    return value;
  } catch { return undefined; }
}
export function rememberPage<T>(key: string, value: T) {
  memory.delete(key); memory.set(key, value);
  while (memory.size > 32) memory.delete(memory.keys().next().value!);
  // Persistence follows the visible response; coalesce rapid local mutations.
  requestIdleCallback(() => {
    if (memory.get(key) !== value) return;
    writeShellValue(prefix + key, JSON.stringify({ value }));
    const keys = shellKeys().filter(item => item.startsWith(prefix) && item !== prefix + key);
    while (keys.length >= 32) removeShellValue(keys.shift()!);
  });
}
export function forgetPage(key: string) { memory.delete(key); removeShellValue(prefix + key); }
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
  for (const cached of [...memory.keys()]) if (cached.startsWith(key)) memory.delete(cached);
  for (const stored of shellKeys()) if (stored.startsWith(prefix + key)) removeShellValue(stored);
}
