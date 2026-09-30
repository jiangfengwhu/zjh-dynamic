import { getAppContext } from "@zijinhua/app-sdk";
const { get: readPackageValue, set: writePackageValue, subscribe: subscribePackageValue } = getAppContext().storage;
const publishFeedPost = getAppContext().feed.publish;
const recordFeedChange = ({ note }: { appId: string; note: string }) => getAppContext().feed.recordChange(note);

export type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
};

const STORAGE_KEY = "notes";

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
  const previous = readNotes();
  const before = new Map(previous.map((note) => [note.id, note]));
  const after = new Map(notes.map((note) => [note.id, note]));
  const added = notes.filter((note) => !before.has(note.id));
  const edited = notes.filter((note) => {
    const old = before.get(note.id);
    return old && (old.title !== note.title || old.content !== note.content);
  });
  const deleted = previous.filter((note) => !after.has(note.id));
  if (!added.length && !edited.length && !deleted.length) return;
  writePackageValue(STORAGE_KEY, JSON.stringify(notes));
  const descriptions = [
    ...added.map((note) => `新建了「${note.title.trim().slice(0, 42) || "无标题笔记"}」`),
    ...edited.map((note) => `修改了「${note.title.trim().slice(0, 42) || "无标题笔记"}」`),
    ...deleted.map((note) => `删除了「${note.title.trim().slice(0, 42) || "无标题笔记"}」`),
  ];
  const body = `${descriptions.slice(0, 3).join("；")}${descriptions.length > 3 ? `等 ${descriptions.length} 项变更` : ""}`;
  recordFeedChange({ appId: "notepad", note: body });
  publishFeedPost({
    kind: "activity",
    body,
    payload: { added: added.length, edited: edited.length, deleted: deleted.length, total: notes.length },
  });
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
