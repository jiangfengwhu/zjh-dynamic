import path from "node:path";
import { assertSdkCompatible } from "../../packages/app-sdk/src/compatibility";
import { readFile, writeFile } from "node:fs/promises";
import { buildApplication } from "./build.js";
import { publishCatalog, bundleEdgeBase } from "../release/publish-bundle.js";
import { publicationToken } from "./authorization.js";

export async function publishApplication(root: string, appId: string) {
const { manifest, bundleFile, output } = await buildApplication(root, appId);
if (manifest.source.repository !== "jiangfengwhu/zjh-plugin") throw new Error("应用只能从 zjh-plugin 仓库发布");
const hostResponse = await fetch(`${bundleEdgeBase()}/v1/release`);
if (!hostResponse.ok) throw new Error("无法读取当前宿主版本");
const host = (await hostResponse.json()).applications;
if (!host) throw new Error("无法读取当前宿主 SDK 版本");
assertSdkCompatible(manifest.sdk, host.sdk);
const publishToken = await publicationToken(root, appId, bundleEdgeBase());
let previous: Response;
try { previous = await fetch(`${bundleEdgeBase()}/v1/applications/${appId}/candidate`, { headers: { Authorization: `Bearer ${publishToken}` }, signal: AbortSignal.timeout(15000) }); }
catch { throw new Error("读取应用发布基线失败：网络暂时不可用，请重新运行发布命令"); }
let expectedRelease: string | null = null;
if (previous.ok) {
  const prior = await previous.json();
  expectedRelease = prior.releaseId;
  if (prior.modules.base !== manifest.modules.base) throw new Error("应用模块范围不可变更");
  if (!/^[a-f0-9]{40}$/.test(prior.source?.commit)) throw new Error("线上应用提交无效");
  if (prior.source.repository !== manifest.source.repository) throw new Error("线上应用仓库与当前源码不一致");

} else if (previous.status === 401 || previous.status === 403) throw new Error("本轮发布授权已失效，请使用新任务提供的发布命令");
else if (previous.status !== 404) throw new Error(`读取应用发布基线失败 status=${previous.status}，请稍后重试`);
const file = path.join(output, "manifest.json");
await writeFile(file, JSON.stringify(manifest));
for (const blob of [{ sha256: manifest.bundle.sha256, file: bundleFile }, ...manifest.assets.map(asset => ({ sha256: asset.sha256, file: path.join(output, "assets", asset.sha256) }))]) {
  const response = await fetch(`${bundleEdgeBase()}/v1/application-blobs/${appId}/${blob.sha256}`, { method: "PUT", headers: { Authorization: `Bearer ${publishToken}`, "Content-Type": "application/octet-stream" }, body: await readFile(blob.file) });
  if (!response.ok) throw new Error(`应用包上传失败 status=${response.status}`);
}

await publishCatalog([
  { key: `v1/applications/${appId}/releases/${manifest.releaseId}`, file, contentType: "application/json", cacheControl: "no-cache" },
  { key: `v1/applications/${appId}/latest`, file, contentType: "application/json", cacheControl: "no-cache" },
], { [appId]: expectedRelease }, publishToken);
console.log(JSON.stringify({ published: true, stage: "candidate", appId, releaseId: manifest.releaseId, commit: manifest.source.commit }));

}
