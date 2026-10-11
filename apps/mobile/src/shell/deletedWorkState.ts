import { readShellValueSync, writeShellValue } from "./shellStorage";

let revision = 0;
export function deletedWorksRevision() { return revision; }
export function isWorkDeleted(appId: string) { return Boolean(readShellValueSync(`shell.work.deleted.${appId}`)); }
export function markWorkDeleted(appId: string, owner: string) {
  if (isWorkDeleted(appId)) return;
  writeShellValue(`shell.work.deleted.${appId}`, owner);
  revision++;
}
