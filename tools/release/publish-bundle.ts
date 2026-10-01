import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { uploadObject } from "./r2.js";
import { parseRelease, sha256Hex, type BundleRelease } from "./release-set.js";

export function bundleCdnBase(): string {
  return (process.env.BUNDLE_CDN_BASE ?? "https://zjh-cdn.297782.xyz").replace(/\/$/, "");
}

export function bundleEdgeBase(): string {
  return (process.env.BUNDLE_EDGE_BASE ?? "https://zijinhua.297782.xyz").replace(/\/$/, "");
}

function bundleBucket(): string {
  return process.env.BUNDLE_R2_BUCKET?.trim() || "zijinhua";
}

type PublishFile = {
  key: string;
  file: string;
  contentType: string;
  cacheControl: string;
};

function runWrangler(args: string[]): Promise<void> {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["wrangler", ...args], {
      shell: process.platform === "win32",
      windowsHide: true,
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const note = output.trim();
      if (note) console.log(note);
      if (code === 0) resolve();
      else reject(new Error(`wrangler exited ${code}`));
    });
  });
}

function r2Credentials(): { accountId: string; accessKeyId: string; secretAccessKey: string } | undefined {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey) return undefined;
  return { accountId, accessKeyId, secretAccessKey };
}

export async function publishBundleObjects(files: PublishFile[]): Promise<void> {
  const bucket = bundleBucket();
  const credentials = r2Credentials();
  for (const item of files) {
    const key = item.key.replace(/^\/+/, "");
    console.log(`publishing ${bundleCdnBase()}/${key}`);
    if (credentials) {
      const body = await readFile(item.file);
      await uploadObject(
        { ...credentials, bucket, prefix: "" },
        key,
        body,
        item.contentType,
        item.cacheControl,
      );
      continue;
    }
    await runWrangler([
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      "--file",
      item.file,
      "--content-type",
      item.contentType,
      "--cache-control",
      item.cacheControl,
      "--remote",
      "--force",
    ]);
  }
}

const IMMUTABLE = "max-age=31536000";

/** 读线上清单；只有 404 表示尚未发布，未知格式或身份校验失败必须停止。 */
export async function fetchRemoteRelease(): Promise<BundleRelease | undefined> {
  const response = await fetch(`${bundleEdgeBase()}/v1/release`);
  if (response.status === 404) {
    console.log("remote release absent");
    return undefined;
  }
  if (!response.ok) throw new Error(`读线上清单失败 status=${response.status}`);
  const release = parseRelease(await response.json());
  if (!release) {
    throw new Error("线上清单格式或内容校验失败，无法核对发布基线，已停止覆盖");
  }
  console.log(`remote release id=${release.id} commit=${release.source.commit.slice(0, 8)} dirty=${release.source.dirty}`);
  return release;
}

/** 读线上的 vendor 编号表，并核对哈希：编号表和主包必须是同一代。 */
export async function fetchRemoteVendorMap(expected: string): Promise<string> {
  const response = await fetch(`${bundleEdgeBase()}/v1/maps/vendor.json`);
  if (!response.ok) throw new Error(`读线上 vendor 编号表失败 status=${response.status}`);
  const text = await response.text();
  if (sha256Hex(text) !== expected) throw new Error("线上 vendor 编号表和清单对不上");
  return text;
}

type Blob = { file: string; sha256: string };

/** 上传新增的包体，再写清单。清单最后写，写成功这一版才算发出去。 */
export async function publishRelease(input: {
  outDir: string;
  release: BundleRelease;
  vendor?: Blob;
  vendorMapFile?: string;
  app: Blob;
  plugins: Array<Blob & { id: string }>;
}): Promise<void> {
  await mkdir(input.outDir, { recursive: true });
  const blobs: PublishFile[] = [];
  const octet = "application/octet-stream";
  if (input.vendor) {
    blobs.push({ key: `v1/vendor/${input.vendor.sha256}`, file: input.vendor.file, contentType: octet, cacheControl: IMMUTABLE });
  }
  blobs.push({ key: `v1/app/${input.app.sha256}`, file: input.app.file, contentType: octet, cacheControl: IMMUTABLE });
  for (const plugin of input.plugins) {
    blobs.push({ key: `v1/plugins/${plugin.id}/${plugin.sha256}`, file: plugin.file, contentType: octet, cacheControl: IMMUTABLE });
  }
  const releaseFile = path.join(input.outDir, "release.json");
  await writeFile(releaseFile, JSON.stringify(input.release));
  const catalog: PublishFile[] = [];
  if (input.vendorMapFile) {
    catalog.push({ key: "v1/maps/vendor.json", file: input.vendorMapFile, contentType: "application/json", cacheControl: "no-cache" });
  }
  catalog.push({ key: "v1/release", file: releaseFile, contentType: "application/json", cacheControl: "no-cache" });
  await publishBundleObjects(blobs);
  await publishCatalog(catalog);
}

export async function publishCatalog(files: PublishFile[], expectedReleases?: Record<string, string | null>, publisherToken?: string): Promise<void> {
  if (files.length === 0) return;
  const token = publisherToken || process.env.OFFICIAL_PUBLISH_TOKEN?.trim() || process.env.BUNDLE_CATALOG_TOKEN?.trim();
  if (!token) {
    if (expectedReleases) throw new Error("候选发布必须使用鉴权 API 的原子基线检查，不允许直接写 KV");
    console.log("BUNDLE_CATALOG_TOKEN 未设置，通过已登录的 wrangler kv 提交清单");
    const namespaceId = process.env.BUNDLE_CATALOG_NAMESPACE_ID?.trim() || "da19ca26504047a596afd448b36a9d6e";
    const release = files.filter((item) => item.key === "v1/release");
    const rest = files.filter((item) => item.key !== "v1/release");
    for (const item of [...rest, ...release]) {
      const key = item.key.replace(/^\/+/, "");
      console.log(`catalog via wrangler kv: ${key}`);
      await runWrangler([
        "kv",
        "key",
        "put",
        key,
        "--path",
        item.file,
        "--namespace-id",
        namespaceId,
        "--remote",
      ]);
    }
    console.log(`catalog published count=${files.length}`);
    return;
  }
  const objects: { key: string; body: string }[] = [];
  for (const item of files) {
    objects.push({ key: item.key.replace(/^\/+/, ""), body: await readFile(item.file, "utf8") });
    console.log(`catalog ${item.key}`);
  }
  const response = await fetch(`${bundleEdgeBase()}/v1/catalog`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ objects, expectedReleases }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`清单上传失败 status=${response.status} ${text.slice(0, 180)}`);
  }
  console.log(`catalog published count=${objects.length}`);
}
