import { createRequire } from "node:module";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

type Package = { name?: string; version?: string; overrides?: unknown; dependencies?: Record<string, string>; devDependencies?: Record<string, string>; peerDependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
const sections = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const;
const packageName = (entry: string) => entry.startsWith("@") ? entry.split("/").slice(0, 2).join("/") : entry.split("/")[0];
const readPackage = async (file: string): Promise<Package> => JSON.parse(await readFile(file, "utf8"));

async function installedPackage(resolver: ReturnType<typeof createRequire>, name: string): Promise<Package> {
  // RN packages may expose a TypeScript main that Node cannot resolve. Inspect
  // installation search paths without executing or resolving the RN entry.
  for (const directory of resolver.resolve.paths(name) ?? []) {
    try { const pkg = await readPackage(path.join(directory, name, "package.json")); if (pkg.name === name) return pkg; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  throw new Error(`无法解析 SDK 依赖：${name}`);
}

/** SDK owns platform dependencies; applications own only their extra JS dependencies. */
export async function assertApplicationDependencies(repo: string, sdkDirectory: string, shared: Record<string, string>) {
  const platform = JSON.parse(await readFile(path.join(sdkDirectory, "platform.json"), "utf8")) as { dependencyArtifacts?: Record<string, { version: string; url: string }> };
  const sdk = await readPackage(path.resolve(sdkDirectory, "../package.json"));
  const root = await readPackage(path.join(repo, "package.json"));
  if (root.overrides) throw new Error("插件仓库不能通过 overrides 改写 SDK 的固定依赖");
  for (const section of sections) for (const name of Object.keys(root[section] ?? {})) {
    if (name !== "@zijinhua/app-sdk") throw new Error(`根 package.json 只声明 SDK；应用的纯 JS 依赖写入对应应用：${name}`);
  }
  const managed = new Set([...Object.keys(sdk.dependencies ?? {}), ...Object.keys(shared).map(packageName), "@zijinhua/app-sdk"]);
  const apps = path.join(repo, "apps");
  const directories = (await readdir(apps, { withFileTypes: true })).filter(entry => entry.isDirectory());
  for (const entry of directories) {
    const file = path.join(apps, entry.name, "package.json");
    let pkg: Package;
    try { pkg = await readPackage(file); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    if (pkg.overrides) throw new Error(`应用不能改写 SDK 依赖：${entry.name}`);
    for (const section of sections) for (const name of Object.keys(pkg[section] ?? {})) {
      const target = pkg[section]![name].match(/^npm:((?:@[^/]+\/)?[^@]+)@/)?.[1];
      if (managed.has(name) || (target && managed.has(target))) throw new Error(`应用 ${entry.name} 不能重复声明或覆盖 SDK 管理的依赖：${name}`);
    }
  }
  const sdkRequire = createRequire(path.join(sdkDirectory, "cli.mjs"));
  for (const [name, version] of new Map(Object.entries(shared).map(([entry, version]) => [packageName(entry), version]))) {
    const artifact = platform.dependencyArtifacts?.[name];
    const pinned = sdk.dependencies?.[name] === version || (artifact?.version === version && sdk.dependencies?.[name] === artifact.url);
    if (!pinned || (await installedPackage(sdkRequire, name)).version !== version) throw new Error(`SDK 安装依赖与平台契约不匹配：${name}`);
    // npm may hoist a newer peer dependency outside the SDK. Applications never
    // bundle those copies: Metro resolves public entries to host stubs first.
    // Explicit application overrides were rejected above; validate the SDK copy.
  }
}
