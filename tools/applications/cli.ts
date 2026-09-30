import path from "node:path";
import { mkdir, readFile, writeFile, readdir, cp } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildApplication } from "./build.js";
import { publishApplication } from "./publish.js";
const [command, appId] = process.argv.slice(2);
const root = process.cwd();
if (!appId || !/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("用法：zjh-app <init|build|publish> <appId>");
if (command === "build") await buildApplication(root, appId);
else if (command === "publish") await publishApplication(root, appId);
else if (command === "init") {
  const platform = JSON.parse(await readFile(path.join(import.meta.dirname, "platform.json"), "utf8"));
  let base = Math.max(...Object.values(platform.reservedModules) as number[]);
  await mkdir(path.join(root, "apps"), { recursive: true });
  for (const id of await readdir(path.join(root, "apps"))) {
    const config = JSON.parse(await readFile(path.join(root, "apps", id, "application.json"), "utf8"));
    base = Math.max(base, config.moduleBase);
  }
  base += platform.moduleRangeSize;
  if (base + platform.moduleRangeSize >= 2 ** 31) throw new Error("应用模块编号已用尽");
  const directory = path.join(root, "apps", appId);
  await mkdir(directory);
  const template = path.join(root, "templates/basic");
  await cp(template, directory, { recursive: true, errorOnExist: true });
  await writeFile(path.join(directory, "application.json"), JSON.stringify({ appId, version: "1.0.0", title: appId, summary: "", mark: appId[0], accent: "#7A5BD0", dataSchemaVersion: 1, moduleBase: base }, null, 2));
  await writeFile(path.join(directory, "package.json"), JSON.stringify({ name: `@zjh-plugin/${appId}`, version: "1.0.0", private: true }, null, 2));
  const run = promisify(execFile);
  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--package-lock-only", "--ignore-scripts"], { cwd: root, windowsHide: true, shell: process.platform === "win32" });
  console.log(`应用已创建：apps/${appId}，模块范围 ${base}`);
} else throw new Error("命令必须为 init、build 或 publish");
