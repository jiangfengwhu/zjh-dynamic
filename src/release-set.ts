import { createHash } from "node:crypto";

/** 线上清单的格式号。手机只认自己看得懂的格式，格式号不认识就当作没有更新。 */
export const RELEASE_FORMAT = 3;

/** 第三方库和 RN 本体，冷启动时作为主包加载。inputs 是它的输入指纹（依赖锁、入口、打包配置），map 是模块编号表的哈希。 */
export type ReleaseVendor = {
  sha256: string;
  bytes: number;
  inputs: string;
  map: string;
};

/** 我们自己的全部代码：壳、components、所有朋友。vendorMap 记录它是对着哪一份编号表打的。 */
export type ReleaseApp = {
  sha256: string;
  bytes: number;
  vendorMap: string;
};

export type ReleasePlugin = {
  id: string;
  className: string;
  dex: string;
  sha256: string;
  bytes: number;
  /** 插件源码的指纹。源码没变就沿用线上那份 DEX，不重新编译。 */
  source: string;
};

/** 这一版是从哪次提交打出来的，供下一次发布检查基线。dirty 表示打包时工作区还有没提交的改动。 */
export type ReleaseSource = {
  commit: string;
  dirty: boolean;
  repository?: string;
};

export type BundleRelease = {
  id: string;
  format: number;
  runtimeVersion: string;
  vendor: ReleaseVendor;
  app: ReleaseApp;
  plugins: ReleasePlugin[];
  source: ReleaseSource;
};

const sha256Pattern = /^[a-f0-9]{64}$/;
const pluginIdPattern = /^[a-z0-9-]+$/;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256Hex(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** 整套清单的编号就是规范 JSON 的哈希：内容一样，编号一样。 */
export function sealRelease(body: Omit<BundleRelease, "id" | "format">): BundleRelease {
  const next = {
    format: RELEASE_FORMAT,
    ...body,
    plugins: [...body.plugins].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)),
  };
  const id = sha256Hex(canonical(next));
  return { id, ...next };
}

function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hex(value: unknown): value is string {
  return typeof value === "string" && sha256Pattern.test(value);
}

function parsePlugin(value: unknown): ReleasePlugin | undefined {
  if (!value || typeof value !== "object") return undefined;
  const plugin = value as Record<string, unknown>;
  if (typeof plugin.id !== "string" || !pluginIdPattern.test(plugin.id)) return undefined;
  if (typeof plugin.className !== "string" || plugin.className.length === 0) return undefined;
  if (plugin.dex !== `${plugin.id}.dex`) return undefined;
  if (!hex(plugin.sha256) || !positive(plugin.bytes) || typeof plugin.source !== "string") return undefined;
  return {
    id: plugin.id,
    className: plugin.className,
    dex: plugin.dex,
    sha256: plugin.sha256,
    bytes: plugin.bytes,
    source: plugin.source,
  };
}

/** 读线上或本地的清单，字段不全、编号对不上、id 和内容对不上都返回 undefined。 */
export function parseRelease(value: unknown): BundleRelease | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  if (raw.format !== RELEASE_FORMAT || !hex(raw.id)) return undefined;
  if (!hex(raw.runtimeVersion)) return undefined;
  const vendor = raw.vendor as Record<string, unknown> | undefined;
  const app = raw.app as Record<string, unknown> | undefined;
  const source = raw.source as Record<string, unknown> | undefined;
  if (!vendor || !hex(vendor.sha256) || !positive(vendor.bytes) || typeof vendor.inputs !== "string" || !hex(vendor.map)) return undefined;
  if (!app || !hex(app.sha256) || !positive(app.bytes) || !hex(app.vendorMap)) return undefined;
  if (app.vendorMap !== vendor.map) return undefined;
  if (!source || typeof source.commit !== "string" || typeof source.dirty !== "boolean") return undefined;
  if (!Array.isArray(raw.plugins)) return undefined;
  const plugins: ReleasePlugin[] = [];
  for (const item of raw.plugins) {
    const plugin = parsePlugin(item);
    if (!plugin) return undefined;
    plugins.push(plugin);
  }
  const release = sealRelease({
    runtimeVersion: raw.runtimeVersion,
    vendor: { sha256: vendor.sha256, bytes: vendor.bytes, inputs: vendor.inputs, map: vendor.map },
    app: { sha256: app.sha256, bytes: app.bytes, vendorMap: app.vendorMap },
    plugins,
    source: { commit: source.commit, dirty: source.dirty, ...(typeof source.repository === "string" ? { repository: source.repository } : {}) },
  });
  return release.id === raw.id ? release : undefined;
}

/** 两份清单装到手机上是不是同样的东西：主包、app、插件都一样。来源提交不算。 */
export function sameContent(left: BundleRelease, right: BundleRelease): boolean {
  if (left.runtimeVersion !== right.runtimeVersion) return false;
  if (left.vendor.sha256 !== right.vendor.sha256 || left.app.sha256 !== right.app.sha256) return false;
  const key = (release: BundleRelease) => release.plugins.map((plugin) => `${plugin.id}:${plugin.sha256}`).sort().join("|");
  return key(left) === key(right);
}
