import { execFileSync } from "node:child_process";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { buildApplication } from "./build.js";
import { publishBundleObjects, publishCatalog, bundleEdgeBase } from "../release/publish-bundle.js";

export async function publishApplication(root: string, appId: string) {
const { manifest, bundleFile, output } = await buildApplication(root, appId);
if (manifest.source.repository !== "jiangfengwhu/zjh-plugin") throw new Error("应用只能从 zjh-plugin 仓库发布");
if (manifest.source.dirty) throw new Error("先提交所有源码改动，再发布应用");
const platformResponse = await fetch(`${bundleEdgeBase()}/v1/runtime`);
if (!platformResponse.ok) throw new Error("无法读取应用平台契约");
const platform = (await platformResponse.json()).applications;
if (!platform || platform.engineAbi !== manifest.requires.engineAbi || !sdkCompatible(manifest.requires.sdk, platform.sdk)) throw new Error("目标平台尚不支持此应用，需要维护者更新 APK 和宿主");
for (const [name, version] of Object.entries(manifest.requires.shared)) if (platform.shared[name] !== version) throw new Error(`平台依赖不匹配：${name}`);
const publishToken = process.env.BUNDLE_CATALOG_TOKEN?.trim() || process.env.OFFICIAL_PUBLISH_TOKEN?.trim();
if (!publishToken) throw new Error("发布候选包需要配置 BUNDLE_CATALOG_TOKEN 或维护者 OFFICIAL_PUBLISH_TOKEN");
const previous = await fetch(`${bundleEdgeBase()}/v1/applications/${appId}/candidate`, { headers: { Authorization: `Bearer ${publishToken}` } });
let expectedRelease: string | null = null;
if (previous.ok) {
  const prior = await previous.json();
  expectedRelease = prior.releaseId;
  if (prior.modules.base !== manifest.modules.base) throw new Error("应用模块范围不可变更");
  if (!/^[a-f0-9]{40}$/.test(prior.source?.commit)) throw new Error("线上应用提交无效");
  const previousRepository = prior.source.repository ?? "jiangfengwhu/zjh-dynamic";
  if (previousRepository === manifest.source.repository) {
    execFileSync("git", ["merge-base", "--is-ancestor", prior.source.commit, manifest.source.commit], { cwd: root, windowsHide: true, stdio: "pipe" });
  } else {
    const transitions = JSON.parse(await readFile(path.join(import.meta.dirname, "repository-migration.json"), "utf8"));
    const approved = transitions[appId];
    if (manifest.source.repository !== "jiangfengwhu/zjh-plugin" || !approved || approved.repository !== previousRepository || approved.commit !== prior.source.commit || approved.releaseId !== prior.releaseId) throw new Error("应用跨仓库发布没有匹配的迁移基线");
  }
} else if (previous.status !== 404) throw new Error("无法读取应用发布基线");
const file = path.join(output, "manifest.json");
await writeFile(file, JSON.stringify(manifest));
await publishBundleObjects([{ key: `v1/app/${manifest.bundle.sha256}`, file: bundleFile, contentType: "application/octet-stream", cacheControl: "public,max-age=31536000,immutable" }]);
await publishBundleObjects(manifest.assets.map(asset => ({ key: `v1/app/${asset.sha256}`, file: path.join(output, "assets", asset.sha256), contentType: "application/octet-stream", cacheControl: "public,max-age=31536000,immutable" })));
await publishCatalog([
  { key: `v1/applications/${appId}/releases/${manifest.releaseId}`, file, contentType: "application/json", cacheControl: "no-cache" },
  { key: `v1/applications/${appId}/latest`, file, contentType: "application/json", cacheControl: "no-cache" },
], { [appId]: expectedRelease });
console.log(JSON.stringify({ published: true, stage: "candidate", appId, releaseId: manifest.releaseId, commit: manifest.source.commit }));

}

function sdkCompatible(required: string, available: string) {
  if (!/^\d+\.\d+\.\d+$/.test(required) || !/^\d+\.\d+\.\d+$/.test(available)) return false;
  const a = required.split(".").map(Number), b = available.split(".").map(Number);
  return a[0] === b[0] && (b[1] > a[1] || (b[1] === a[1] && b[2] >= a[2]));
}
