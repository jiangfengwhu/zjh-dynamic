import { readPackageValue, writePackageValue, subscribePackageValue } from "../../ui/packageLink";

export type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
};

const STORAGE_KEY = "notepad.notes";

export function readNotes(): Note[] {
  const raw = readPackageValue(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function writeNotes(notes: Note[]) {
  writePackageValue(STORAGE_KEY, JSON.stringify(notes));
}

export function subscribeNotes(listener: (notes: Note[]) => void): () => void {
  return subscribePackageValue(STORAGE_KEY, (raw) => {
    if (!raw) {
      listener([]);
      return;
    }
    try {
      listener(JSON.parse(raw));
    } catch {
      listener([]);
    }
  });
}
