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
  if (!token) throw new Error("未找到本轮发布身份，请使用任务提供的初始化或发布命令");
  return token;
}

/** Keep the task credential local; exchange a fresh short-lived token at publication. */
export async function publicationToken(root: string, appId: string, edge: string): Promise<string> {
  const credential = await applicationPublisher(root, appId);
  if (!credential.startsWith("zjh1.")) return credential; // Explicit maintainer credentials.
  let response: Response;
  try {
    response = await fetch(`${edge}/v1/application-publisher/${appId}`, { method: "POST", headers: { Authorization: `Bearer ${credential}` }, signal: AbortSignal.timeout(15000) });
  } catch { throw new Error("发布授权获取失败：网络暂时不可用，请重新运行发布命令"); }
  if (response.status === 401 || response.status === 403) throw new Error("本轮发布授权已失效，请在紫金花继续制作后使用新任务提供的发布命令");
  if (!response.ok) throw new Error(`发布授权获取失败 status=${response.status}，请重新运行发布命令`);
  const body = await response.json() as { token?: string };
  if (typeof body.token !== "string" || !/^zjh1\.[A-Za-z0-9+/=]+\.[a-f0-9]{64}$/.test(body.token)) throw new Error("发布授权响应无效，请稍后重试");
  return body.token;
}
