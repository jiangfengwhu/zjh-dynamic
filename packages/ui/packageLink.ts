import { createMMKV, type MMKV } from "react-native-mmkv";

const STORAGE_ID = "zijinhua.link";

type Listener = (value: string | undefined) => void;

let storage: MMKV | undefined;
const listeners = new Map<string, Set<Listener>>();

function store(): MMKV {
  if (!storage) storage = createMMKV({ id: STORAGE_ID });
  return storage;
}

export function readPackageValue(key: string): string | undefined {
  return store().getString(key);
}

export function writePackageValue(key: string, value: string) {
  const current = store().getString(key);
  if (current === value) return;
  store().set(key, value);
  console.log("package link", key, value.length);
  const group = listeners.get(key);
  if (!group) return;
  for (const listener of [...group]) listener(value);
}

export function subscribePackageValue(key: string, listener: Listener): () => void {
  let group = listeners.get(key);
  if (!group) {
    group = new Set();
    listeners.set(key, group);
  }
  group.add(listener);
  return () => {
    group.delete(listener);
  };
}

export function removePackageValue(key: string) {
  if (!store().contains(key)) return;
  store().remove(key);
  for (const listener of [...(listeners.get(key) ?? [])]) listener(undefined);
}
