import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, realpath, readdir, stat, copyFile } from "node:fs/promises";
import path from "node:path";
import { sha256Hex } from "../release/release-set.js";

const run = promisify(execFile);

export async function buildApplication(repo: string, appId: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("应用 ID 无效");
  const root = path.join(repo, "packages/features", appId);
  const mobile = path.join(repo, "apps/mobile");
  const output = path.join(repo, "dist/applications", appId);
  const config = JSON.parse(await readFile(path.join(root, "application.json"), "utf8"));
  if (config.appId !== appId || !/^\d+\.\d+\.\d+$/.test(config.version)) throw new Error("应用配置无效");
  const allocations = JSON.parse(await readFile(path.join(repo, "tools/applications/allocations.json"), "utf8"));
  const bases = Object.values(allocations.applications) as number[];
  if (new Set(bases).size !== bases.length || bases.some(base => !Number.isSafeInteger(base) || base < 2000000 || base % allocations.moduleRangeSize)) throw new Error("模块编号分配冲突");
  if (!allocations.applications[appId]) throw new Error("应用尚未分配模块范围");
  await mkdir(path.join(output, "external"), { recursive: true });
  const lock = JSON.parse(await readFile(path.join(mobile, "package-lock.json"), "utf8"));
  const publicModules = JSON.parse(await readFile(path.join(repo, "tools/applications/public-modules.json"), "utf8"));
  const sharedNames: string[] = [...publicModules.shared, "@zijinhua/app-sdk", "@zijinhua/app-sdk/ui", "@zijinhua/app-sdk/creation"];
  const shared: Record<string, string> = {};
  for (const name of sharedNames) {
    const packageName = name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : name.split("/")[0];
    const version = packageName === "@zijinhua/app-sdk" ? publicModules.sdk : lock.packages[`node_modules/${packageName}`]?.version;
    if (!version) throw new Error(`共享依赖没有锁定版本：${name}`);
    shared[name] = version;
    await writeFile(path.join(output, "external", `${Buffer.from(name).toString("hex")}.js`), `module.exports = globalThis.__zijinhuaApplications.require(${JSON.stringify(name)}, ${JSON.stringify(appId)});\n`);
  }
  await writeFile(path.join(output, "public-modules.json"), JSON.stringify(shared));
  const entry = path.join(output, "entry.js");
  const sourceEntry = await realpath(path.join(root, "index.ts"));
  await writeFile(entry, `const definition = require(${JSON.stringify(sourceEntry.replaceAll("\\", "/"))}).default;\nglobalThis.__zijinhuaApplications.register(${JSON.stringify(appId)}, definition);\n`);
  process.env.ZIJINHUA_APPLICATION_ROOT = root;
  process.env.ZIJINHUA_APPLICATION_OUTPUT = output;
  process.env.ZIJINHUA_APPLICATION_ID = appId;
  const require = createRequire(path.join(mobile, "package.json"));
  const Metro = require("metro");
  const bundleOutput = require(path.join(mobile, "node_modules/metro/src/shared/output/bundle.js"));
  const metroConfig = await Metro.loadConfig({ cwd: mobile, projectRoot: mobile, config: path.join(repo, "tools/applications/metro.config.cjs") });
  const bundleFile = path.join(output, "application.bundle");
  const jsFile = path.join(output, "application.js");
  try {
    await Metro.runBuild(metroConfig, {
      entry, bundleOut: jsFile, platform: "android", dev: false, minify: true, sourceMap: true, sourceMapOut: path.join(output, "application.js.map"),
      output: { build: (server: object, options: object) => bundleOutput.build(server, { ...options, modulesOnly: true, runModule: true }), save: bundleOutput.save },
    });
  } finally {
    delete process.env.ZIJINHUA_APPLICATION_ROOT;
    delete process.env.ZIJINHUA_APPLICATION_OUTPUT;
    delete process.env.ZIJINHUA_APPLICATION_ID;
  }
  const folder = process.platform === "win32" ? "win64-bin" : process.platform === "darwin" ? "osx-bin" : "linux64-bin";
  await run(path.join(mobile, "node_modules/hermes-compiler/hermesc", folder, process.platform === "win32" ? "hermesc.exe" : "hermesc"), ["-w", "-emit-binary", "-out", bundleFile, "-O", jsFile], { windowsHide: true });
  const bytes = await readFile(bundleFile);
  const assets: Array<{ name: string; sha256: string; bytes: number }> = [];
  async function collectAssets(directory: string, prefix = "") {
    let names: string[];
    try { names = await readdir(directory); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    for (const name of names) {
      const full = path.join(directory, name);
      const logical = prefix ? `${prefix}/${name}` : name;
      if ((await stat(full)).isDirectory()) { await collectAssets(full, logical); continue; }
      const content = await readFile(full);
      const hash = sha256Hex(content);
      await mkdir(path.join(output, "assets"), { recursive: true });
      await copyFile(full, path.join(output, "assets", hash));
      assets.push({ name: logical, sha256: hash, bytes: content.length });
    }
  }
  await collectAssets(path.join(root, "assets"));
  const used = JSON.parse(await readFile(path.join(output, "used-modules.json"), "utf8")) as string[];
  const dependencies = Object.fromEntries(used.filter(name => !name.startsWith("@zijinhua/")).map(name => [name, shared[name]]));
  const source = (await run("git", ["rev-parse", "HEAD"], { cwd: repo, windowsHide: true })).stdout.trim();
  const dirty = Boolean((await run("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: repo, windowsHide: true })).stdout.trim());
  const body = {
    ...config, format: 1, requires: { engineAbi: `rn-${shared["react-native"]}-hermes-${lock.packages["node_modules/hermes-compiler"].version}`, sdk: publicModules.sdk, shared: dependencies },
    modules: { base: allocations.applications[appId], size: allocations.moduleRangeSize },
    bundle: { sha256: sha256Hex(bytes), bytes: bytes.length }, assets: assets.sort((a, b) => a.name.localeCompare(b.name)), source: { commit: source, dirty },
  };
  const manifest = { ...body, releaseId: sha256Hex(JSON.stringify(body)) };
  await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ appId, releaseId: manifest.releaseId, bytes: bytes.length, output }));
  return { manifest, bundleFile, output };
}
