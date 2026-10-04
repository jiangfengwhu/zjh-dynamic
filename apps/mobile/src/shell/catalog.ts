import { readShellValue, writeShellValue } from "./shellStorage";

const CATALOG_KEY = "shell.bundles.v1";
const listeners = new Set<(entries: CatalogEntry[]) => void>();
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
  try {
    const raw = await readShellValue(CATALOG_KEY);
    if (!raw) return [];
    const file = JSON.parse(raw) as CatalogFile;
    return Array.isArray(file.entries)
      ? file.entries.filter((entry) => entry.id !== "jolly")
      : [];
  } catch (error) {
    console.log(
      "bundle catalog unreadable",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

export async function saveCatalog(entries: CatalogEntry[]) {
  entries = entries.filter((entry) => entry.id !== "jolly");
  const file: CatalogFile = { entries };
  writeShellValue(CATALOG_KEY, JSON.stringify(file));
  for (const listener of listeners) listener(entries);
}
