import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { bundleEdgeBase } from "../tools/release/publish-bundle.js";

const [appId, releaseId, decision] = process.argv.slice(2);
const token = process.env.OFFICIAL_PUBLISH_TOKEN?.trim() || (await readFile(path.join(os.homedir(), ".codex", "zjh-official-publish-token"), "utf8")).trim();
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
if (!appId) {
  const response = await fetch(`${bundleEdgeBase()}/v1/application-review`, { headers });
  if (!response.ok) throw new Error(`无法读取审核队列：${response.status}`);
  console.log(JSON.stringify(await response.json(), null, 2));
} else {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId) || !/^[a-f0-9]{64}$/.test(releaseId ?? "") || !["--approve", "--reject"].includes(decision)) throw new Error("用法：npm run review:applications [-- <appId> <releaseId> --approve|--reject]。批准前须人工检查对应源码、依赖和产物。");
  const response = await fetch(`${bundleEdgeBase()}/v1/application-review`, { method: "POST", headers, body: JSON.stringify({ appId, releaseId, approved: decision === "--approve" }) });
  const result = await response.json() as { message?: string };
  if (!response.ok) throw new Error(result.message || `审核未完成：${response.status}`);
  console.log(JSON.stringify(result));
}
