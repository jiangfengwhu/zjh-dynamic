import { createMMKV, type MMKV } from "react-native-mmkv";

const STORAGE_ID = "zijinhua.shell";

let storage: MMKV | undefined;

function store(): MMKV {
  if (!storage) storage = createMMKV({ id: STORAGE_ID });
  return storage;
}

export async function readShellValue(key: string): Promise<string | undefined> {
  return store().getString(key);
}

export function writeShellValue(key: string, value: string) {
  store().set(key, value);
}

export function removeShellValue(key: string) {
  store().remove(key);
}
export function shellKeys() { return store().getAllKeys(); }
