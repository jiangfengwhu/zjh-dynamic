const MAX_ROWS = 192;
const PAGE_ROWS = 48;
const MAX_CHARACTERS = 128 * 1024;
export type PageSnapshot = { header: string; pages: Record<string, string> };
/** Disk snapshots are bounded; never truncate a list while retaining its cursor. */
export function encodePageSnapshot(value: unknown): PageSnapshot | undefined {
  let rows = 0;
  const inspect = (item: unknown): boolean => {
    if (Array.isArray(item)) { rows += item.length; if (rows > MAX_ROWS) return false; return item.every(inspect); }
    if (item && typeof item === "object") return Object.values(item).every(inspect);
    return true;
  };
  if (!inspect(value)) return undefined;
  const pages: Record<string, string> = {};
  const arrays: Record<string, string[]> = {};
  let metadata = value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const fields: Record<string, unknown> = { ...value };
    for (const [name, items] of Object.entries(fields)) {
      if (!Array.isArray(items)) continue;
      delete fields[name]; arrays[name] = [];
      for (let offset = 0; offset < items.length; offset += PAGE_ROWS) {
        const part = name + ":" + offset / PAGE_ROWS;
        arrays[name].push(part); pages[part] = JSON.stringify(items.slice(offset, offset + PAGE_ROWS));
      }
    }
    metadata = fields;
  }
  const header = JSON.stringify({ format: 2, value: metadata, arrays });
  if (header.length + Object.values(pages).reduce((total, part) => total + part.length, 0) > MAX_CHARACTERS) return undefined;
  return { header, pages };
}
export function decodePageSnapshot(raw: string, read: (part: string) => string | undefined): unknown {
  const stored = JSON.parse(raw);
  if (stored.format !== 2) return stored.value;
  const value = stored.value;
  for (const [name, parts] of Object.entries(stored.arrays) as [string, string[]][]) {
    const items = parts.flatMap(part => { const raw = read(part); if (raw === undefined) throw new Error("Incomplete page cache"); const page = JSON.parse(raw); if (!Array.isArray(page)) throw new Error("Invalid page cache"); return page; });
    value[name] = items;
  }
  return value;
}
