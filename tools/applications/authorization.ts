import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";

function directory(root: string) {
  return path.resolve(root, execFileSync("git", ["rev-parse", "--git-path", "zjh-publisher"], { cwd: root, encoding: "utf8", windowsHide: true }).trim());
}
export async function authorizeApplication(root: string, appId: string, token: string) {
  if (!/^zjh1\.[A-Za-z0-9+/=]+\.[a-f0-9]{64}$/.test(token)) throw new Error("应用发布授权格式无效");
  const grant = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8"));
  if (grant.appId !== appId || grant.expiresAt <= Date.now()) throw new Error("应用发布授权不匹配或已过期");
  const folder = directory(root); await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, appId), token, { mode: 0o600 });
  console.log(`已保存 ${appId} 本轮发布授权`);
}
export async function applicationPublisher(root: string, appId: string): Promise<string> {
  try { return (await readFile(path.join(directory(root), appId), "utf8")).trim(); } catch {}
  const token = process.env.OFFICIAL_PUBLISH_TOKEN?.trim();
  if (!token) throw new Error("请执行任务提供的初始化或发布命令，附带本轮授权；维护者可配置 OFFICIAL_PUBLISH_TOKEN");
  return token;
}
