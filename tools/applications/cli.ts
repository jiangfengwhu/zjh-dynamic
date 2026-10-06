import path from "node:path";
import { mkdir, readFile, writeFile, cp } from "node:fs/promises";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { buildApplication } from "./build.js";
import { publishApplication } from "./publish.js";
import { authorizeApplication, applicationPublisher } from "./authorization.js";
const [command, appId, argument] = process.argv.slice(2);
const root = process.cwd();
if (!appId || !/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("用法：zjh-app <authorize|init|build|publish> <appId>");
if (command === "authorize") await authorizeApplication(root, appId, argument ?? "");
else if (command === "build") await buildApplication(root, appId);
else if (command === "publish") {
  if (argument) await authorizeApplication(root, appId, argument);
  await publishApplication(root, appId);
}
else if (command === "init") {
  if (argument) await authorizeApplication(root, appId, argument);
  const platform = JSON.parse(await readFile(path.join(import.meta.dirname, "platform.json"), "utf8"));
  await mkdir(path.join(root, "apps"), { recursive: true });
  const url = `${process.env.BUNDLE_EDGE_BASE || platform.edge}/v1/application-allocation/${appId}`;
  const token = await applicationPublisher(root, appId);
  let response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 404 && token) response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("尚未分配应用模块范围，请先在 Jolly 发起这个应用的创作");
  const { moduleBase: base, originalAppId, originalReleaseId, originalCommit } = await response.json();
  if (!Number.isSafeInteger(base) || base < 2000000 || base % platform.moduleRangeSize || base + platform.moduleRangeSize >= 2 ** 31) throw new Error("服务端模块范围无效");
  const directory = path.join(root, "apps", appId);
  await mkdir(directory);
  const template = path.join(root, "templates/basic");
  await cp(template, directory, { recursive: true, errorOnExist: true });
  let original = {};
  let dependencies: Record<string, string> | undefined;
  if (originalAppId) {
    if (!/^[a-z][a-z0-9-]{0,63}$/.test(originalAppId) || !/^[a-f0-9]{40}$/.test(originalCommit) || !/^[a-f0-9]{64}$/.test(originalReleaseId)) throw new Error("原作版本无效");
    const prefix = `apps/${originalAppId}/`;
    try { execFileSync("git", ["cat-file", "-e", `${originalCommit}^{commit}`], { cwd: root, windowsHide: true, stdio: "pipe" }); }
    catch { execFileSync("git", ["fetch", "origin", originalCommit], { cwd: root, windowsHide: true, stdio: "pipe" }); }
    const files = execFileSync("git", ["ls-tree", "-rz", "--name-only", originalCommit, "--", `${prefix}src`, `${prefix}assets`], { cwd: root, encoding: "utf8", windowsHide: true }).split("\0").filter(Boolean);
    if (!files.length) throw new Error("锁定提交中没有原作源码，请同步仓库历史后重试");
    for (const file of files) {
      const relative = file.slice(prefix.length);
      if (!/^(src|assets)\//.test(relative) || relative.split("/").some(part => part === "..")) throw new Error("原作路径无效");
      const target = path.join(directory, relative); await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, execFileSync("git", ["show", `${originalCommit}:${file}`], { cwd: root, maxBuffer: 40 * 1024 * 1024, windowsHide: true }));
    }
    const prior = JSON.parse(execFileSync("git", ["show", `${originalCommit}:${prefix}application.json`], { cwd: root, encoding: "utf8", windowsHide: true }));
    const priorPackage = JSON.parse(execFileSync("git", ["show", `${originalCommit}:${prefix}package.json`], { cwd: root, encoding: "utf8", windowsHide: true }));
    dependencies = priorPackage.dependencies;
    original = { appName: prior.appName, description: prior.description, accent: prior.accent, originalAppId, originalReleaseId, originalCommit };
  }
  await writeFile(path.join(directory, "application.json"), JSON.stringify({ appName: "", description: "", accent: "#7A5BD0", ...original, appId, version: "1.0.0", releaseNotes: "", moduleBase: base }, null, 2));
  await writeFile(path.join(directory, "package.json"), JSON.stringify({ name: `@zjh-plugin/${appId}`, private: true, ...(dependencies ? { dependencies } : {}) }, null, 2));
  const run = promisify(execFile);
  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--package-lock-only", "--ignore-scripts"], { cwd: root, windowsHide: true, shell: process.platform === "win32" });
  console.log(`应用已创建：apps/${appId}，模块范围 ${base}`);
} else throw new Error("命令必须为 authorize、init、build 或 publish");
