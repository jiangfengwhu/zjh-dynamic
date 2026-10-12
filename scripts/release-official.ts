import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { bundleEdgeBase } from "../tools/release/publish-bundle.js";

const [appId, releaseId, branch = "main", ...extra] = process.argv.slice(2);
if (extra.length || !/^[a-z][a-z0-9-]{0,63}$/.test(appId || "") || !/^[a-f0-9]{64}$/.test(releaseId || "")) throw new Error("用法：npm run release:official -- <appId> <releaseId> [sourceBranch]。这是将指定官方版本公开的维护者操作。");
execFileSync("git", ["check-ref-format", `refs/heads/${branch}`], { windowsHide: true, stdio: "pipe" });
const token = process.env.OFFICIAL_PUBLISH_TOKEN?.trim() || (await readFile(path.join(os.homedir(), ".codex", "zjh-official-publish-token"), "utf8")).trim();
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
const response = await fetch(`${bundleEdgeBase()}/v1/applications/${appId}/releases/${releaseId}`, { headers });
if (!response.ok) throw new Error(`无法读取指定版本：${response.status}`);
const manifest = await response.json();
if (manifest.source.repository !== "jiangfengwhu/zjh-plugin" || manifest.source.dirty || manifest.releaseId !== releaseId) throw new Error("官方版本来源不匹配");
const pluginRoot = process.env.PLUGIN_REPOSITORY_ROOT || path.resolve(process.cwd(), "../zjh-plugin");
execFileSync("git", ["fetch", "origin", `${branch}:refs/remotes/origin/${branch}`], { cwd: pluginRoot, windowsHide: true, stdio: "pipe" });
execFileSync("git", ["merge-base", "--is-ancestor", manifest.source.commit, `origin/${branch}`], { cwd: pluginRoot, windowsHide: true, stdio: "pipe" });
const promoted = await fetch(`${bundleEdgeBase()}/v1/official-release`, { method: "POST", headers, body: JSON.stringify({ appId, releaseId, branch }) });
if (!promoted.ok) { const error = await promoted.json() as { message?: string }; throw new Error(error.message || `公开发布失败：${promoted.status}`); }
console.log(JSON.stringify(await promoted.json()));
