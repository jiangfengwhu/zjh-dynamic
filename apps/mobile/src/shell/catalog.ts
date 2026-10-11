import { readShellValueSync, writeShellValue } from "./shellStorage";

const CATALOG_KEY = "shell.bundles.v1";
const listeners = new Set<(entries: CatalogEntry[]) => void>();
let cachedRaw: string | undefined;
let cachedEntries: CatalogEntry[] = [];
export function subscribeCatalog(listener: (entries: CatalogEntry[]) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export type CatalogEntry = {
  id: string;
  hidden: boolean;
  pinned?: boolean;
  trashedAt?: number;
  purged?: boolean;
  titleOverride?: string;
  lastOpenedAt?: number;
};

/** 壳里列出的一个应用。导航按这个形状传递。 */
export type AppEntry = {
  id: string;
  title: string;
  summary: string;
  pinned: boolean;
  lastOpenedAt?: number;
};

type CatalogFile = {
  entries: CatalogEntry[];
};

export async function loadCatalog(): Promise<CatalogEntry[]> {
  return loadCatalogSync();
}

/** Read immediately before a synchronous catalog mutation to retain newer edits. */
export function loadCatalogSync(): CatalogEntry[] {
  try {
    const raw = readShellValueSync(CATALOG_KEY);
    if (!raw) return [];
    if (raw !== cachedRaw) {
      const file = JSON.parse(raw) as CatalogFile;
      cachedEntries = Array.isArray(file.entries) ? file.entries : [];
      cachedRaw = raw;
    }
    // Callers may mutate their snapshot; never expose the cached objects.
    return cachedEntries.map(entry => ({ ...entry }));
  } catch (error) {
    console.log(
      "bundle catalog unreadable",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

export async function saveCatalog(entries: CatalogEntry[]) {
  const file: CatalogFile = { entries };
  writeShellValue(CATALOG_KEY, JSON.stringify(file));
  for (const listener of listeners) listener(entries);
}
