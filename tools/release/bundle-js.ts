import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { fetchRuntimeContract, downloadBridgeSdk } from "./runtime-contract.js";
import { compilePlugins, listPluginIds, pluginSourceHash } from "./compile-plugins.js";
import {
  bundleCdnBase,
  bundleEdgeBase,
  fetchRemoteRelease,
  fetchRemoteVendorMap,
  publishRelease,
  publishBundleObjects,
} from "./publish-bundle.js";
import { sameContent, sealRelease, sha256Hex, type BundleRelease, type ReleasePlugin, type ReleaseSource, type ReleaseVendor } from "./release-set.js";

const execFileAsync = promisify(execFile);

export type BundleOptions = {
  /** 上传包体并写线上清单。 */
  publish: boolean;
  /** 不管输入有没有变，重新打 vendor。 */
  forceVendor?: boolean;
};

export type BundleResult = {
  release: BundleRelease;
  published: boolean;
  vendorRebuilt: boolean;
};

type BuiltBundle = { sha256: string; bytes: number };

export function parseBundleOptions(argv: string[]): { forceVendor: boolean } {
  for (const item of argv) {
    if (item === "--only" || item.startsWith("--only=")) {
      throw new Error("不再需要 --only：直接执行 npx tsx scripts/cloud-publish.ts，发布范围由脚本自己判断");
    }
    if (item !== "--vendor") throw new Error(`无法识别的参数 ${item}`);
  }
  return { forceVendor: argv.includes("--vendor") };
}

/**
 * 一次打包发布的全过程。
 * 1. 读线上现行的整套清单，检查当前分支包含线上这一版的提交。
 * 2. vendor 的输入指纹（依赖锁、入口、打包配置）没变就沿用线上那份，变了才重新打。
 * 3. app 每次整包重打，其余插件按源码指纹决定要不要重新编译。
 * 4. 新增的包体先上传，最后写清单。
 */
export async function bundleRelease(repoRoot: string, summary: string, options: BundleOptions): Promise<BundleResult> {
  const mobileDir = path.join(repoRoot, "apps", "mobile");
  const contract = await fetchRuntimeContract();
  const runtime = contract.runtimeVersion;
  await downloadBridgeSdk(repoRoot, contract.bridgeSdk);
  const outDir = path.join(repoRoot, "dist", "bundles");
  // 提交状态要在生成任何文件之前读，才不会把打包自己写的文件算成「未提交的改动」。
  const source = await readSource(repoRoot);
  if (options.publish && (source.dirty || !/^[a-f0-9]{40}$/.test(source.commit))) throw new Error("发布必须来自干净的 Git 提交，请先提交全部源码改动");
  source.buildId = randomUUID();
  await writeFile(path.join(mobileDir, "src", "shell", "build-identity.json"), JSON.stringify({ buildId: source.buildId, apk: contract.apk }));
  await mkdir(outDir, { recursive: true });
  const dependencyLock = JSON.parse(await readFile(path.join(mobileDir, "package-lock.json"), "utf8"));
  const publicModules = JSON.parse(await readFile(path.join(repoRoot, "tools/applications/public-modules.json"), "utf8"));
  const publicNames: string[] = publicModules.shared;
  const shared = Object.fromEntries(publicNames.map(name => [name, dependencyLock.packages[`node_modules/${(name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : name.split("/")[0])}`].version]));
  const applicationContract = { engineAbi: `rn-${shared["react-native"]}-hermes-${dependencyLock.packages["node_modules/hermes-compiler"].version}`, sdk: publicModules.sdk, shared };
  if (!contract.applications || contract.applications.engineAbi !== applicationContract.engineAbi || Object.entries(shared).some(([name, version]) => contract.applications?.shared[name] !== version)) throw new Error("宿主公共依赖与目标 APK 契约不匹配，需要维护者协调发布");
  await writeFile(path.join(mobileDir, "src/runtime/application-contract.json"), JSON.stringify(applicationContract));

  await writeFile(
    path.join(mobileDir, "src", "shell", "evolveHost.ts"),
    `export const bundleR2Url = ${JSON.stringify(bundleCdnBase())};\nexport const edgeUrl = ${JSON.stringify(bundleEdgeBase())};\n`,
  );

  const remote = await readRemote(options);
  if (options.publish) await assertBaseline(repoRoot, remote, source);

  await writeVendorLibs(repoRoot, mobileDir);
  const mapFile = path.join(outDir, "module-ids-vendor.json");
  if (remote) {
    await writeFile(mapFile, await fetchRemoteVendorMap(remote.vendor.map));
    console.log("vendor map from remote");
  }
  const inputs = await vendorInputs(mobileDir);
  const reuseVendor = Boolean(remote) && !options.forceVendor && remote?.runtimeVersion === runtime && remote?.vendor.inputs === inputs;

  let vendor: ReleaseVendor;
  let vendorFile = "";
  if (reuseVendor && remote) {
    vendor = remote.vendor;
    console.log(`vendor reused sha256=${vendor.sha256.slice(0, 12)}`);
  } else {
    const built = await bundleLayer(mobileDir, path.join(mobileDir, "vendor-entry.js"), path.join(outDir, "vendor.js"), path.join(outDir, "vendor.bundle"), "vendor", false);
    vendorFile = path.join(outDir, "vendor.bundle");
    const map = await readVendorMap(mapFile);
    vendor = { ...built, inputs: await vendorInputs(mobileDir), map: sha256Hex(map) };
    console.log(`vendor ready sha256=${vendor.sha256.slice(0, 12)} bytes=${vendor.bytes}`);
  }

  const appBuilt = await bundleLayer(mobileDir, path.join(mobileDir, "app-entry.js"), path.join(outDir, "app.js"), path.join(outDir, "app.bundle"), "app", true);
  const app = { ...appBuilt, vendorMap: vendor.map };
  console.log(`app ready sha256=${app.sha256.slice(0, 12)} bytes=${app.bytes}`);


  const plugins = options.publish ? await resolvePlugins(repoRoot, remote) : { records: remote?.plugins ?? [], built: [] };
  // Host media uses immutable URLs and ships independently of application plugins.
  const hostMedia = path.join(mobileDir, "assets", "jolly");
  const media = JSON.parse(await readFile(path.join(hostMedia, "manifest.json"), "utf8")) as Record<string, string>;
  for (const [name, hash] of Object.entries(media)) {
    const file = path.join(hostMedia, `${name}.mp4`);
    if (!/^[a-z_]+$/.test(name) || sha256Hex(await readFile(file)) !== hash) throw new Error("宿主动画资源与源码清单不一致");
    if (options.publish) {
      const existing = await fetch(`${bundleCdnBase()}/v1/app/${hash}`, { method: "HEAD" });
      if (!existing.ok) await publishBundleObjects([{ key: `v1/app/${hash}`, file, contentType: "video/mp4", cacheControl: "public,max-age=31536000,immutable" }]);
    }
  }
  const release = sealRelease({ applications: applicationContract, runtimeVersion: runtime, vendor, app, plugins: plugins.records, source });
  console.log(`release ready id=${release.id} vendor=${vendor.sha256.slice(0, 12)} app=${app.sha256.slice(0, 12)} plugins=${release.plugins.length} summary=${summary.slice(0, 80)}`);
  if (!options.publish) {
    console.log("skip publish");
    return { release, published: false, vendorRebuilt: Boolean(vendorFile) };
  }
  if (remote && sameContent(release, remote)) {
    console.log("线上已经是这一版，不用重复发布");
    return { release: remote, published: false, vendorRebuilt: Boolean(vendorFile) };
  }
  const vendorChanged = Boolean(vendorFile) && vendor.sha256 !== remote?.vendor.sha256;
  await publishRelease({
    outDir,
    release,
    vendor: vendorChanged ? { file: vendorFile, sha256: vendor.sha256 } : undefined,
    vendorMapFile: vendor.map !== remote?.vendor.map ? mapFile : undefined,
    app: { file: path.join(outDir, "app.bundle"), sha256: app.sha256 },
    plugins: plugins.built,
  });
  return { release, published: true, vendorRebuilt: Boolean(vendorFile) };
}

async function readRemote(options: BundleOptions): Promise<BundleRelease | undefined> {
  if (options.publish) return fetchRemoteRelease();
  try {
    return await fetchRemoteRelease();
  } catch (error) {
    // 只装机不发布时读不到线上也能继续：这时 vendor 编号从本地表接着往下排。
    console.log(`remote release skipped ${(error as Error).message}`);
    return undefined;
  }
}

async function readVendorMap(file: string): Promise<string> {
  const globals = globalThis as { __zijinhuaFlushModuleMaps?: () => void };
  globals.__zijinhuaFlushModuleMaps?.();
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    throw new Error("vendor 打完了，但没有找到模块编号表", { cause: error });
  }
}

async function bundleLayer(
  mobileDir: string,
  entry: string,
  jsPath: string,
  bundlePath: string,
  layer: "vendor" | "app",
  modulesOnly: boolean,
): Promise<BuiltBundle> {
  process.env.ZIJINHUA_LAYER = layer;
  console.log(`bundling ${layer}`);
  try {
    await metroBundle(mobileDir, entry, jsPath, modulesOnly);
    await compileHermes(mobileDir, jsPath, bundlePath);
  } finally {
    delete process.env.ZIJINHUA_LAYER;
  }
  const bytes = await readFile(bundlePath);
  return { sha256: sha256Hex(bytes), bytes: bytes.length };
}

async function resolvePlugins(
  repoRoot: string,
  remote: BundleRelease | undefined,
): Promise<{ records: ReleasePlugin[]; built: Array<{ id: string; file: string; sha256: string }> }> {
  const ids = await listPluginIds(repoRoot);
  const records: ReleasePlugin[] = [];
  const stale: string[] = [];
  const sources = new Map<string, string>();
  for (const id of ids) {
    const sourceHash = await pluginSourceHash(repoRoot, id);
    sources.set(id, sourceHash);
    const prior = remote?.plugins.find((plugin) => plugin.id === id && plugin.source === sourceHash);
    if (prior) records.push(prior);
    else stale.push(id);
  }
  const built: Array<{ id: string; file: string; sha256: string }> = [];
  if (stale.length > 0) {
    const compiled = await compilePlugins(repoRoot, stale);
    console.log(`plugins compiled count=${compiled.length}`);
    for (const plugin of compiled) {
      records.push({
        id: plugin.id,
        className: plugin.className,
        dex: plugin.dex,
        sha256: plugin.sha256,
        bytes: plugin.bytes,
        source: sources.get(plugin.id) ?? "",
      });
      built.push({ id: plugin.id, file: path.join(repoRoot, "dist", "plugins", plugin.dex), sha256: plugin.sha256 });
    }
  }
  return { records, built };
}

async function git(repoRoot: string, args: string[]): Promise<{ code: number; stdout: string }> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd: repoRoot, windowsHide: true });
    return { code: 0, stdout };
  } catch (error) {
    const failure = error as { code?: unknown; stdout?: string };
    return { code: typeof failure.code === "number" ? failure.code : -1, stdout: failure.stdout ?? "" };
  }
}

async function readSource(repoRoot: string): Promise<ReleaseSource> {
  const head = await git(repoRoot, ["rev-parse", "HEAD"]);
  if (head.code !== 0) {
    console.log("not a git checkout; release records no commit");
    return { commit: "", dirty: false, repository: "jiangfengwhu/zjh-dynamic" };
  }
  const status = await git(repoRoot, ["status", "--porcelain"]);
  if (status.code !== 0) throw new Error("无法核对源码状态，已停止打包");
  const dirty = status.stdout.trim().length > 0;
  if (dirty) console.log("working tree has uncommitted changes; they are part of this release");
  return { commit: head.stdout.trim(), dirty, repository: "jiangfengwhu/zjh-dynamic" };
}

/** 线上这一版是从哪次提交打出来的；当前分支必须包含它，否则这次发布会把线上已有的内容悄悄覆盖掉。 */
async function assertBaseline(repoRoot: string, remote: BundleRelease | undefined, source: ReleaseSource) {
  if (remote && remote.source.repository !== "jiangfengwhu/zjh-dynamic") {
    throw new Error("线上发布来源不是 zjh-dynamic，停止覆盖");
  }
  const base = remote?.source.commit;
  if (!remote || !base) return;
  if (remote.source.dirty) {
    throw new Error(`线上版本 ${base.slice(0, 8)} 来自未提交改动，请维护者核实源码后建立可追溯基线`);
  }
  if (!source.commit) {
    throw new Error("当前不是 Git 仓库，无法核对线上提交基线");
  }
  const known = await git(repoRoot, ["cat-file", "-e", `${base}^{commit}`]);
  const ancestor = known.code === 0 ? await git(repoRoot, ["merge-base", "--is-ancestor", base, "HEAD"]) : undefined;
  if (ancestor?.code === 0) {
    console.log(`baseline ok commit=${base.slice(0, 8)}`);
    return;
  }
  const reason = known.code !== 0
    ? `线上这一版基于提交 ${base.slice(0, 8)}，当前仓库里没有这个提交。先 git fetch 并把它合并进当前分支，再发布`
    : `当前分支不包含线上这一版的提交 ${base.slice(0, 8)}。先把主分支合并进来，再发布`;
  throw new Error(reason);
}

async function readIfExists(file: string): Promise<Buffer> {
  try {
    return await readFile(file);
  } catch {
    return Buffer.alloc(0);
  }
}

/** vendor 的输入指纹：这些文件都没变，打出来的 vendor 就还是线上那一份。 */
async function vendorInputs(mobileDir: string): Promise<string> {
  const files = [
    "package.json",
    "package-lock.json",
    "vendor-entry.js",
    "vendor-libs.js",
    "app.json",
    "babel.config.js",
    "metro.config.js",
    "metro.ids.cjs",
    path.join("src", "runtime", "shellSlot.tsx"),
  ];
  const parts: string[] = [];
  for (const file of files) {
    parts.push(`${file.replaceAll("\\", "/")}:${sha256Hex(await readIfExists(path.join(mobileDir, file)))}`);
  }
  for (const file of (await readdir(path.join(mobileDir, "patches"))).filter(file => file.endsWith(".patch")).sort()) {
    parts.push(`patches/${file}:${sha256Hex(await readFile(path.join(mobileDir, "patches", file)))}`);
  }
  // UI and SDK implementations belong to main/app and never invalidate vendor.
  return sha256Hex(parts.join("\n"));
}

const earlyPackages = new Set(["react-native-get-random-values", "react-native-gesture-handler", "react-native-reanimated"]);

/** 扫出仓库里所有第三方引用，写成 vendor-libs.js。vendor 借它把这些库全部收进来，app 里就不再带任何第三方模块。 */
async function writeVendorLibs(repoRoot: string, mobileDir: string) {
  const packageJson = JSON.parse(await readFile(path.join(mobileDir, "package.json"), "utf8")) as { dependencies?: Record<string, string> };
  const specifiers = new Set<string>(Object.keys(packageJson.dependencies ?? {}));
  const roots = [path.join(mobileDir, "src"), path.join(repoRoot, "packages", "ui"), path.join(repoRoot, "packages", "platform")];
  for (const root of roots) await collectPackageSpecifiers(root, specifiers);
  collectFromSource(await readIfExists(path.join(mobileDir, "App.tsx")).then((bytes) => bytes.toString("utf8")), specifiers);
  const lines = [...specifiers]
    .filter((item) => item.length > 0 && !item.startsWith(".") && !item.startsWith("@zijinhua/") && !earlyPackages.has(item))
    .sort();
  const body = `globalThis.__zijinhuaVendorLibraries = {\n${lines.map((item) => `${JSON.stringify(item)}: () => require(${JSON.stringify(item)}),`).join("\n")}\n};`;
  await writeFile(path.join(mobileDir, "vendor-libs.js"), `${body}\n`);
  console.log(`vendor libs count=${lines.length}`);
}

async function collectPackageSpecifiers(dir: string, specifiers: Set<string>) {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const full = path.join(dir, name);
    const info = await stat(full);
    if (info.isDirectory()) {
      await collectPackageSpecifiers(full, specifiers);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(name)) continue;
    collectFromSource(await readFile(full, "utf8"), specifiers);
  }
}

function collectFromSource(source: string, specifiers: Set<string>) {
  for (const match of source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)[\s\S]*?\sfrom\s*["']([^"']+)["']/g)) {
    addSpecifier(specifiers, match[1]);
  }
  for (const match of source.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) addSpecifier(specifiers, match[1]);
  for (const match of source.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) addSpecifier(specifiers, match[1]);
}

function addSpecifier(specifiers: Set<string>, specifier: string) {
  if (!specifier || specifier.startsWith(".") || specifier.startsWith("/") || specifier.startsWith("node:")) return;
  specifiers.add(specifier);
}

async function metroBundle(mobileDir: string, entry: string, bundleOut: string, modulesOnly: boolean) {
  const require = createRequire(path.join(mobileDir, "package.json"));
  const Metro = require("metro") as {
    loadConfig: (options: { cwd: string; projectRoot: string; config: string }) => Promise<object>;
    runBuild: (config: object, options: object) => Promise<unknown>;
  };
  const metroRoot = path.join(mobileDir, "node_modules", "metro");
  const output = require(path.join(metroRoot, "src", "shared", "output", "bundle.js")) as {
    build: (server: object, options: object) => Promise<{ code: string; map: string }>;
    save: (bundle: { code: string; map: string }, options: object, log: (message: string) => void) => Promise<void>;
  };
  const config = await Metro.loadConfig({
    cwd: mobileDir,
    projectRoot: mobileDir,
    config: path.join(mobileDir, "metro.config.js"),
  });
  await Metro.runBuild(config, {
    entry,
    bundleOut,
    dev: false,
    minify: true,
    platform: "android",
    sourceMap: false,
    output: modulesOnly
      ? {
          build: (server: object, requestOptions: object) =>
            output.build(server, { ...requestOptions, modulesOnly: true, runModule: true }),
          save: output.save,
        }
      : undefined,
  });
}

async function compileHermes(mobileDir: string, jsPath: string, bundlePath: string) {
  const hermescFolder = process.platform === "win32" ? "win64-bin" : process.platform === "darwin" ? "osx-bin" : "linux64-bin";
  const hermescName = process.platform === "win32" ? "hermesc.exe" : "hermesc";
  const hermesc = path.join(mobileDir, "node_modules", "hermes-compiler", "hermesc", hermescFolder, hermescName);
  console.log(`compiling hermes bytecode ${path.basename(bundlePath)}`);
  await execFileAsync(
    hermesc,
    ["-w", "-emit-binary", "-max-diagnostic-width=80", "-out", bundlePath, "-O", jsPath],
    { cwd: mobileDir, windowsHide: true },
  );
}
