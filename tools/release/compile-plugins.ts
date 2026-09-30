import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type CompiledPlugin = {
  id: string;
  className: string;
  dex: string;
  sha256: string;
  bytes: number;
};

function sdkRoot(): string {
  return process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.LOCALAPPDATA ?? "", "Android", "Sdk");
}

async function findFile(dir: string, name: string): Promise<string | undefined> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const nested = await findFile(full, name);
      if (nested) return nested;
    }
  }
  return undefined;
}

async function androidJar(): Promise<string> {
  const jar = await findFile(path.join(sdkRoot(), "platforms"), "android.jar");
  if (!jar) throw new Error("找不到 android.jar，无法编译 DEX 插件");
  return jar;
}

async function d8Tool(): Promise<string> {
  const name = process.platform === "win32" ? "d8.bat" : "d8";
  const tool = await findFile(path.join(sdkRoot(), "build-tools"), name);
  if (!tool) throw new Error(`找不到 ${name}，无法编译 DEX 插件`);
  return tool;
}

function javacBin(): string {
  const javaHome = process.env.JAVA_HOME;
  const file = process.platform === "win32" ? "javac.exe" : "javac";
  if (javaHome) return path.join(javaHome, "bin", file);
  if (process.platform === "win32") return "C:\\Program Files\\Microsoft\\jdk-21.0.12.101-hotspot\\bin\\javac.exe";
  throw new Error("缺少 JAVA_HOME，无法编译 DEX 插件");
}

async function listJava(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await listJava(full)));
    else if (entry.name.endsWith(".java")) found.push(full);
  }
  return found;
}

export async function compilePlugins(repoRoot: string, only?: readonly string[]): Promise<CompiledPlugin[]> {
  if (only && only.length === 0) return [];
  const pluginsDir = path.join(repoRoot, "plugins");
  const outDir = path.join(repoRoot, "dist", "plugins");
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let entries;
  try {
    entries = await readdir(pluginsDir, { withFileTypes: true });
  } catch {
    if (only && only.length > 0) throw new Error(`缺少插件 ${only.join(",")}`);
    return [];
  }

  const jar = await androidJar();
  const d8 = await d8Tool();
  const javac = javacBin();
  const stubDir = path.join(repoRoot, "dist", "sdk", "bridge-sdk.jar");
  await readFile(stubDir);

  const compiled: CompiledPlugin[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    if (!/^[a-z0-9-]+$/.test(id)) {
      console.log(`skip plugin dir ${id}`);
      continue;
    }
    if (only && !only.includes(id)) continue;
    const pluginRoot = path.join(pluginsDir, id);
    const manifest = JSON.parse(await readFile(path.join(pluginRoot, "plugin.json"), "utf8")) as {
      id?: string;
      className?: string;
    };
    if (manifest.id !== id || !manifest.className) {
      throw new Error(`插件 ${id} 的 plugin.json 缺少匹配的 id 或 className`);
    }
    const sources = await listJava(path.join(pluginRoot, "src"));
    if (sources.length === 0) throw new Error(`插件 ${id} 没有 Java 源码`);
    const classes = path.join(repoRoot, "dist", "plugin-classes", id);
    await rm(classes, { recursive: true, force: true });
    await mkdir(classes, { recursive: true });
    await execFileAsync(
      javac,
      ["--release", "17", "-classpath", `${stubDir}${path.delimiter}${jar}`, "-d", classes, ...sources],
      { windowsHide: true },
    );
    const classFiles = (await listClassFiles(classes)).filter((file) => !file.endsWith("module-info.class"));
    const dexName = `${id}.dex`;
    const dexPath = path.join(outDir, dexName);
    await execFileAsync(d8, ["--min-api", "26", "--lib", jar, "--output", outDir, ...classFiles], {
      windowsHide: true,
      shell: process.platform === "win32",
    });
    const produced = path.join(outDir, "classes.dex");
    await renameDex(produced, dexPath);
    const bytes = await readFile(dexPath);
    const record: CompiledPlugin = {
      id,
      className: manifest.className,
      dex: dexName,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
    };
    await writeFile(
      path.join(outDir, `${id}.json`),
      JSON.stringify({ className: record.className, dex: dexName, sha256: record.sha256 }),
    );
    compiled.push(record);
    console.log(`plugin compiled id=${id} sha256=${record.sha256} bytes=${bytes.length}`);
  }
  if (only) {
    const missing = only.filter((id) => !compiled.some((item) => item.id === id));
    if (missing.length > 0) throw new Error(`缺少插件 ${missing.join(",")}`);
  }
  return compiled;
}

/** 仓库里现有的插件 id：plugins/ 下名字合规的目录。 */
export async function listPluginIds(repoRoot: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(path.join(repoRoot, "plugins"), { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && /^[a-z0-9-]+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function listFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await listFiles(full)));
    else found.push(full);
  }
  return found;
}

/** 插件源码的指纹：插件目录加上下载的桥接 SDK。指纹没变，线上那份 DEX 就还是对的，不必重新编译。 */
export async function pluginSourceHash(repoRoot: string, id: string): Promise<string> {
  const hash = createHash("sha256");
  const files = [
    ...(await listFiles(path.join(repoRoot, "plugins", id))),
    path.join(repoRoot, "dist", "sdk", "bridge-sdk.jar"),
  ].sort();
  for (const file of files) {
    hash.update(path.relative(repoRoot, file).replaceAll("\\", "/"));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex");
}

async function listClassFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await listClassFiles(full)));
    else if (entry.name.endsWith(".class")) found.push(full);
  }
  return found;
}

async function renameDex(from: string, to: string) {
  const { rename } = await import("node:fs/promises");
  await rename(from, to);
}
