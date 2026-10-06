import { createRequire } from "node:module";
import { assertApplicationDependencies } from "./dependencies.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile, realpath, readdir, stat, copyFile } from "node:fs/promises";
import path from "node:path";
import { sha256Hex } from "../release/release-set.js";
import { applicationSource } from "./source.js";

const run = promisify(execFile);

export async function buildApplication(repo: string, appId: string) {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("应用 ID 无效");
  const source = await applicationSource(repo);
  const root = path.join(repo, "apps", appId);
  const mobile = repo;
  const output = path.join(repo, "dist/applications", appId);
  const config = JSON.parse(await readFile(path.join(root, "application.json"), "utf8"));
  if (config.appId !== appId || !/^\d+\.\d+\.\d+$/.test(config.version)) throw new Error("应用配置无效");
  if (typeof config.title !== "string" || !config.title.trim() || config.title.length > 60 || config.title.trim() === "新作品") throw new Error("请在 application.json 中按应用用途填写名称（1–60 字），不要保留模板名称");
  if (typeof config.summary !== "string" || !config.summary.trim() || config.summary.length > 300) throw new Error("请在 application.json 中填写实际用途与功能简介（1–300 字）");
  if (typeof config.mark !== "string" || !config.mark.trim() || typeof config.accent !== "string" || !/^#[a-fA-F0-9]{6}$/.test(config.accent)) throw new Error("请在 application.json 中填写与应用主题相符的 mark 和六位十六进制 accent 配色");
  const sdkDirectory = import.meta.dirname;
  const platform = JSON.parse(await readFile(path.join(sdkDirectory, "platform.json"), "utf8"));
  await assertApplicationDependencies(repo, sdkDirectory, platform.shared);
  const base = config.moduleBase;
  if (!Number.isSafeInteger(base) || base < 2000000 || base % platform.moduleRangeSize || base + platform.moduleRangeSize >= 2 ** 31) throw new Error("应用模块范围无效");
  if (platform.reservedModules[appId] !== undefined && platform.reservedModules[appId] !== base) throw new Error("应用模块范围不可变更");
  await mkdir(path.join(output, "external"), { recursive: true });
  const publicModules = { sdk: platform.sdk };
  const sharedNames: string[] = [...Object.keys(platform.shared), "@zijinhua/app-sdk", "@zijinhua/app-sdk/ui", "@zijinhua/app-sdk/creation"];
  const shared: Record<string, string> = {};
  for (const name of sharedNames) {
    const packageName = name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : name.split("/")[0];
    const version = packageName === "@zijinhua/app-sdk" ? publicModules.sdk : platform.shared[name];
    if (!version) throw new Error(`共享依赖没有锁定版本：${name}`);
    shared[name] = version;
    await writeFile(path.join(output, "external", `${Buffer.from(name).toString("hex")}.js`), `module.exports = globalThis.__zijinhuaApplications.require(${JSON.stringify(name)}, ${JSON.stringify(appId)});\n`);
  }
  await writeFile(path.join(output, "public-modules.json"), JSON.stringify(shared));
  await writeFile(path.join(output, "used-modules.json"), "[]");
  const entry = path.join(output, "entry.js");
  const sourceEntry = await realpath(path.join(root, "src/index.ts"));
  await writeFile(entry, `const definition = require(${JSON.stringify(sourceEntry.replaceAll("\\", "/"))}).default;\nglobalThis.__zijinhuaApplications.register(${JSON.stringify(appId)}, definition);\n`);
  process.env.ZIJINHUA_APPLICATION_ROOT = root;
  process.env.ZIJINHUA_APPLICATION_REPO = repo;
  process.env.ZIJINHUA_APPLICATION_BASE = String(base);
  process.env.ZIJINHUA_APPLICATION_OUTPUT = output;
  process.env.ZIJINHUA_APPLICATION_ID = appId;
  const require = createRequire(import.meta.url);
  const Metro = require("metro");
  const bundleOutput = require(path.join(path.dirname(require.resolve("metro/package.json")), "src/shared/output/bundle.js"));
  const metroConfig = await Metro.loadConfig({ cwd: mobile, projectRoot: mobile, config: path.join(sdkDirectory, "metro.config.cjs") });
  const bundleFile = path.join(output, "application.bundle");
  const jsFile = path.join(output, "application.js");
  try {
    await Metro.runBuild(metroConfig, {
      entry, bundleOut: jsFile, platform: "android", dev: false, minify: true, sourceMap: true, sourceMapOut: path.join(output, "application.js.map"),
      output: { build: (server: object, options: object) => bundleOutput.build(server, { ...options, modulesOnly: true, runModule: true }), save: bundleOutput.save },
    });
  } finally {
    delete process.env.ZIJINHUA_APPLICATION_ROOT;
    delete process.env.ZIJINHUA_APPLICATION_REPO;
    delete process.env.ZIJINHUA_APPLICATION_BASE;
    delete process.env.ZIJINHUA_APPLICATION_OUTPUT;
    delete process.env.ZIJINHUA_APPLICATION_ID;
  }
  const folder = process.platform === "win32" ? "win64-bin" : process.platform === "darwin" ? "osx-bin" : "linux64-bin";
  await run(path.join(path.dirname(require.resolve("hermes-compiler/package.json")), "hermesc", folder, process.platform === "win32" ? "hermesc.exe" : "hermesc"), ["-w", "-emit-binary", "-out", bundleFile, "-O", path.basename(jsFile)], { cwd: output, windowsHide: true });
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
  if ((await applicationSource(repo)).tree !== source.tree) throw new Error("构建期间源码发生变化，请重新发布");
  const body = {
    ...config, format: 1, requires: { engineAbi: platform.engineAbi, sdk: publicModules.sdk, shared: dependencies },
    modules: { base, size: platform.moduleRangeSize },
    bundle: { sha256: sha256Hex(bytes), bytes: bytes.length }, assets: assets.sort((a, b) => a.name.localeCompare(b.name)), source,
  };
  const manifest = { ...body, releaseId: sha256Hex(JSON.stringify(body)) };
  await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ appId, releaseId: manifest.releaseId, bytes: bytes.length, output }));
  return { manifest, bundleFile, output };
}
