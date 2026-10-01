import { execFile, execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { buildApplication } from "./build.js";
import { publishCatalog, bundleEdgeBase, bundleCdnBase } from "../release/publish-bundle.js";
import { sha256Hex } from "../release/release-set.js";
import { applicationPublisher } from "./authorization.js";

export async function publishApplication(root: string, appId: string) {
const { manifest, bundleFile, output } = await buildApplication(root, appId);
if (manifest.source.repository !== "jiangfengwhu/zjh-plugin") throw new Error("应用只能从 zjh-plugin 仓库发布");
if (manifest.source.dirty) throw new Error("先提交所有源码改动，再发布应用");
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
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", prior.source.commit, manifest.source.commit], { cwd: root, windowsHide: true, stdio: "pipe" });
  } catch {
    let exportedAncestor = false;
    const exported = previous.headers.get("X-Application-Source-Commit");
    if (prior.source.tree && exported && /^[a-f0-9]{40}$/.test(exported)) {
      try {
        try { execFileSync("git", ["cat-file", "-e", `${exported}^{commit}`], { cwd: root, windowsHide: true, stdio: "pipe" }); }
        catch { execFileSync("git", ["fetch", "origin", exported], { cwd: root, windowsHide: true, stdio: "pipe" }); }
        const tree = execFileSync("git", ["rev-parse", `${exported}^{tree}`], { cwd: root, windowsHide: true, encoding: "utf8", stdio: "pipe" }).trim();
        if (tree !== prior.source.tree) throw new Error("导出提交源码树不匹配");
        execFileSync("git", ["merge-base", "--is-ancestor", exported, manifest.source.commit], { cwd: root, windowsHide: true, stdio: "pipe" });
        exportedAncestor = true;
      } catch { /* Fall back only to verifiably identical content. */ }
    }
    // Jules can recreate a commit when exporting its PR. Only identical source or
    // byte-for-byte identical release content can reconcile that rewritten baseline.
    const sameTree = prior.source.tree && prior.source.tree === manifest.source.tree;
    const sameContent = releaseContent(prior) === releaseContent(manifest);
    const sameBytecode = !exportedAncestor && !sameTree && !sameContent && releaseContent(prior, true) === releaseContent(manifest, true) && await equivalentBytecode(prior.bundle, bundleFile, output);
    if (!exportedAncestor && !sameTree && !sameContent && !sameBytecode) throw new Error("候选源码基线不一致，且源码树及重建产物均不匹配；请同步当前版本后重新发布");
    console.log(exportedAncestor ? "baseline verified: exported GitHub commit is an ancestor with matching source tree" : sameTree ? "baseline reconciled: identical Git source tree" : "baseline reconciled: identical rebuilt bundle, assets and application contract");
  }
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

function releaseContent(manifest: Record<string, unknown>, normalizeBundle = false): string {
  const { source, releaseId, ...content } = manifest;
  if (normalizeBundle) content.bundle = { ...content.bundle as object, sha256: "<bytecode>", bytes: 0 };
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  return JSON.stringify(canonical(content));
}

// The entire disassembly must match; only the single compiler input filename
// in the debug filename table may differ between Linux and Windows.
export function normalizeCompilerFilename(dump: string): string | undefined {
  const normalized = dump.replace(/\r\n/g, "\n");
  const table = /\nDebug filename table:\n  0: [^\n]*application\.js\n\nDebug file table:\n/;
  return table.test(normalized) ? normalized.replace(table, "\nDebug filename table:\n  0: <application.js>\n\nDebug file table:\n") : undefined;
}

async function equivalentBytecode(prior: { sha256: string; bytes: number }, current: string, output: string): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(prior.sha256) || !Number.isSafeInteger(prior.bytes) || prior.bytes <= 0 || prior.bytes > 40 * 1024 * 1024) return false;
  const response = await fetch(`${bundleCdnBase()}/v1/app/${prior.sha256}`);
  if (!response.ok) throw new Error("无法下载候选包核对重建结果");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== prior.bytes || sha256Hex(bytes) !== prior.sha256) throw new Error("候选包内容校验失败");
  const previous = path.join(output, `baseline-${prior.sha256}.bundle`); await writeFile(previous, bytes);
  const require = createRequire(import.meta.url);
  const folder = process.platform === "win32" ? "win64-bin" : process.platform === "darwin" ? "osx-bin" : "linux64-bin";
  const compiler = path.join(path.dirname(require.resolve("hermes-compiler/package.json")), "hermesc", folder, process.platform === "win32" ? "hermesc.exe" : "hermesc");
  const run = promisify(execFile);
  const priorDump = normalizeCompilerFilename((await run(compiler, ["-b", "-dump-bytecode", previous], { encoding: "utf8", windowsHide: true, maxBuffer: 128 * 1024 * 1024 })).stdout);
  const currentDump = normalizeCompilerFilename((await run(compiler, ["-b", "-dump-bytecode", current], { encoding: "utf8", windowsHide: true, maxBuffer: 128 * 1024 * 1024 })).stdout);
  return priorDump !== undefined && currentDump !== undefined && priorDump === currentDump;
}

function sdkCompatible(required: string, available: string) {
  if (!/^\d+\.\d+\.\d+$/.test(required) || !/^\d+\.\d+\.\d+$/.test(available)) return false;
  const a = required.split(".").map(Number), b = available.split(".").map(Number);
  return a[0] === b[0] && (b[1] > a[1] || (b[1] === a[1] && b[2] >= a[2]));
}
