import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { buildApplication } from "../tools/applications/build.js";
import { publishBundleObjects, publishCatalog, bundleEdgeBase } from "../tools/release/publish-bundle.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appId = process.argv[2];
if (!appId) throw new Error("用法：npm run publish:application -- <appId>");
const { manifest, bundleFile, output } = await buildApplication(root, appId);
if (manifest.source.dirty) throw new Error("先提交所有源码改动，再发布应用");
const platformResponse = await fetch(`${bundleEdgeBase()}/v1/runtime`);
if (!platformResponse.ok) throw new Error("无法读取应用平台契约");
const platform = (await platformResponse.json()).applications;
if (!platform || platform.engineAbi !== manifest.requires.engineAbi || !sdkCompatible(manifest.requires.sdk, platform.sdk)) throw new Error("目标平台尚不支持此应用，需要维护者更新 APK 和宿主");
for (const [name, version] of Object.entries(manifest.requires.shared)) if (platform.shared[name] !== version) throw new Error(`平台依赖不匹配：${name}`);
const previous = await fetch(`${bundleEdgeBase()}/v1/applications/${appId}/latest`);
if (previous.ok) {
  const prior = await previous.json();
  if (prior.dataSchemaVersion !== manifest.dataSchemaVersion) throw new Error("首版 SDK 暂不允许自动改变存储结构版本，请由维护者设计迁移后发布");
  if (prior.modules.base !== manifest.modules.base) throw new Error("应用模块范围不可变更");
  if (!/^[a-f0-9]{40}$/.test(prior.source?.commit)) throw new Error("线上应用提交无效");
  execFileSync("git", ["merge-base", "--is-ancestor", prior.source.commit, manifest.source.commit], { cwd: root, windowsHide: true, stdio: "pipe" });
} else if (previous.status !== 404) throw new Error("无法读取应用发布基线");
const file = path.join(output, "manifest.json");
await writeFile(file, JSON.stringify(manifest));
await publishBundleObjects([{ key: `v1/app/${manifest.bundle.sha256}`, file: bundleFile, contentType: "application/octet-stream", cacheControl: "public,max-age=31536000,immutable" }]);
await publishBundleObjects(manifest.assets.map(asset => ({ key: `v1/app/${asset.sha256}`, file: path.join(output, "assets", asset.sha256), contentType: "application/octet-stream", cacheControl: "public,max-age=31536000,immutable" })));
await publishCatalog([
  { key: `v1/applications/${appId}/releases/${manifest.releaseId}`, file, contentType: "application/json", cacheControl: "no-cache" },
  { key: `v1/applications/${appId}/latest`, file, contentType: "application/json", cacheControl: "no-cache" },
]);
console.log(JSON.stringify({ published: true, appId, releaseId: manifest.releaseId, commit: manifest.source.commit }));

function sdkCompatible(required: string, available: string) {
  if (!/^\d+\.\d+\.\d+$/.test(required) || !/^\d+\.\d+\.\d+$/.test(available)) return false;
  const a = required.split(".").map(Number), b = available.split(".").map(Number);
  return a[0] === b[0] && (b[1] > a[1] || (b[1] === a[1] && b[2] >= a[2]));
}
