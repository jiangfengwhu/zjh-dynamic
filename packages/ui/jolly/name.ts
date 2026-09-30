import { useEffect, useState } from "react";
import { createMMKV } from "react-native-mmkv";
import { readPackageValue, subscribePackageValue, writePackageValue } from "../packageLink";

const KEY = "shell.companion.name.v1";

export function readCompanionName(): string {
  const shared = readPackageValue(KEY);
  if (shared?.trim()) return shared.trim();
  // 保留旧版工坊已经起好的名字。
  const legacy = createMMKV({ id: "zijinhua.shell" }).getString(KEY)?.trim();
  const name = legacy || "狗蛋";
  writePackageValue(KEY, name);
  return name;
}

export function setCompanionName(name: string) {
  writePackageValue(KEY, name.trim() || "狗蛋");
}

export function useCompanionName(): string {
  const [name, setName] = useState(readCompanionName);
  useEffect(() => subscribePackageValue(KEY, () => setName(readCompanionName())), []);
  return name;
}
