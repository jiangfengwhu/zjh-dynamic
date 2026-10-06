import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { buildApplication } from "./build.js";
import { publishCatalog, bundleEdgeBase } from "../release/publish-bundle.js";
import { applicationPublisher } from "./authorization.js";

export async function publishApplication(root: string, appId: string) {
const { manifest, bundleFile, output } = await buildApplication(root, appId);
if (manifest.source.repository !== "jiangfengwhu/zjh-plugin") throw new Error("应用只能从 zjh-plugin 仓库发布");
const platformResponse = await fetch(`${bundleEdgeBase()}/v1/runtime`);
if (!platformResponse.ok) throw new Error("无法读取应用平台契约");
const platform = (await platformResponse.json()).applications;
if (!platform || platform.engineAbi !== manifest.requires.engineAbi || !sdkCompatible(manifest.requires.sdk, platform.sdk)) throw new Error("目标平台尚不支持此应用，需要维护者更新 APK 和宿主");
for (const [name, version] of Object.entries(manifest.requires.shared)) if (platform.shared[name] !== version) throw new Error(`平台依赖不匹配：${name}`);
const publishToken = await applicationPublisher(root, appId);
const previous = await fetch(`${bundleEdgeBase()}/v1/applications/${appId}/candidate`, { headers: { Authorization: `Bearer ${publishToken}` } });
let expectedRelease: string | null = null;
if (previous.ok) {
  const prior = await previous.json();
  expectedRelease = prior.releaseId;
  if (prior.modules.base !== manifest.modules.base) throw new Error("应用模块范围不可变更");
  if (!/^[a-f0-9]{40}$/.test(prior.source?.commit)) throw new Error("线上应用提交无效");
  if (prior.source.repository !== manifest.source.repository) throw new Error("线上应用仓库与当前源码不一致");

} else if (previous.status !== 404) throw new Error("无法读取应用发布基线");
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

function sdkCompatible(required: string, available: string) {
  if (!/^\d+\.\d+\.\d+$/.test(required) || !/^\d+\.\d+\.\d+$/.test(available)) return false;
  const a = required.split(".").map(Number), b = available.split(".").map(Number);
  return a[0] === b[0] && (b[1] > a[1] || (b[1] === a[1] && b[2] >= a[2]));
}
