const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../..").replaceAll("\\", "/");
const mobileModules = `${repoRoot}/apps/mobile/node_modules/`;
const outDir = path.resolve(__dirname, "../../dist/bundles");
/** vendor 的编号在 [1, VENDOR_MAX)，app 从 APP_BASE 起，两段不重叠。 */
const VENDOR_MAX = 1000000;
const APP_BASE = 1000000;

function mapFile(name) {
  return path.join(outDir, `module-ids-${name}.json`);
}

function loadMap(name) {
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(mapFile(name), "utf8"));
  } catch {
    return {};
  }
  return normalizeMap(name, raw);
}

function saveMap(name, map) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(mapFile(name), JSON.stringify(map));
}

/** 编号表的键。仓库文件用相对路径，依赖收成 node_modules/<包>/...，换机器也不变。 */
// Logical keys retain the published vendor IDs when physical directories move.
function logicalKey(key) {
  if (key.startsWith('packages/platform/src/')) return 'features/src/lib/' + key.slice(22);
  if (key.startsWith('apps/mobile/')) return key.slice(5);
  if (key.startsWith('packages/features/')) return key.slice(9);
  if (key.startsWith('packages/ui/')) return 'components/' + key.slice(12);
  if (key.startsWith('dist/sdk-adapters/')) return key;
  return key;
}

function moduleKey(filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (normalized.startsWith(mobileModules)) return `node_modules/${normalized.slice(mobileModules.length)}`;
  if (normalized.startsWith(`${repoRoot}/`)) return logicalKey(normalized.slice(repoRoot.length + 1));
  throw new Error(`模块不在仓库里: ${filePath}`);
}

function isThirdParty(filePath) {
  return moduleKey(filePath).startsWith("node_modules/");
}

function looksAbsolute(key) {
  return /^[A-Za-z]:[\\/]/.test(key) || key.startsWith("/");
}

/** 旧表用的是本机绝对路径。编号保留，只把键改成稳定路径；两把旧键落到同一处就停下来。 */
function normalizeMap(name, map) {
  const next = {};
  let dirty = false;
  for (const [key, id] of Object.entries(map)) {
    const stable = looksAbsolute(key) ? moduleKey(key) : key;
    if (stable !== key) dirty = true;
    if (next[stable] != null && next[stable] !== id) {
      throw new Error(`模块编号冲突 ${name} ${stable}: ${next[stable]} 和 ${id}`);
    }
    next[stable] = id;
  }
  if (dirty) {
    saveMap(name, next);
    console.log(`module map normalized ${name} count=${Object.keys(next).length}`);
  }
  return next;
}

/** vendor 编号表只增不改：已有的键永远保持原编号，新模块接在最大编号后面。写盘推迟到 flushModuleMaps 或进程退出，避免每个新模块写一遍 400 KB。 */
function createVendorIdFactory() {
  const map = loadMap("vendor");
  let next = 1;
  for (const id of Object.values(map)) {
    if (typeof id === "number" && id < VENDOR_MAX) next = Math.max(next, id + 1);
  }
  let added = 0;
  const save = () => {
    if (added === 0) return;
    saveMap("vendor", map);
    console.log(`module map saved vendor count=${Object.keys(map).length} added=${added}`);
    added = 0;
  };
  globalThis.__zijinhuaFlushModuleMaps = save;
  return (filePath) => {
    const key = moduleKey(filePath);
    if (map[key] == null) {
      if (next >= VENDOR_MAX) throw new Error("vendor module id space exhausted");
      map[key] = next++;
      added += 1;
    }
    return map[key];
  };
}

/** app 每次整包重打，编号不需要跨次保存：vendor 里已有的模块沿用它的编号，其余按出现顺序从 APP_BASE 起。 */
function createAppIdFactory() {
  const vendor = loadMap("vendor");
  if (Object.keys(vendor).length === 0) {
    throw new Error("没有 vendor 模块编号，先打包 vendor");
  }
  const local = new Map();
  let next = APP_BASE;
  return (filePath) => {
    const key = moduleKey(filePath);
    if (vendor[key] != null) return vendor[key];
    if (isThirdParty(filePath)) throw new Error(`第三方模块不在 vendor 包里: ${key}。依赖有变化，需要重新打包 vendor`);
    const cached = local.get(key);
    if (cached != null) return cached;
    if (next >= 2000000) throw new Error("宿主模块编号范围已用尽");
    local.set(key, next);
    return next++;
  };
}

/** 写出 vendor 编号表里这一轮新增的键。打包脚本在 vendor 打完后通过 globalThis.__zijinhuaFlushModuleMaps 调用，这样不受模块被加载几次的影响。 */
function flushModuleMaps() {
  if (typeof globalThis.__zijinhuaFlushModuleMaps === "function") globalThis.__zijinhuaFlushModuleMaps();
}

process.on("exit", flushModuleMaps);

let snapshotLayer = "";
let snapshot = new Set();

/** app 打包时要排除的模块：vendor 编号表里的键，无论内容有没有变。 */
function ownedPaths() {
  const layer = process.env.ZIJINHUA_LAYER || "";
  if (layer !== snapshotLayer) {
    snapshotLayer = layer;
    snapshot = new Set(layer === "app" ? Object.keys(loadMap("vendor")) : []);
  }
  return snapshot;
}

function createModuleIdFactory() {
  const layer = process.env.ZIJINHUA_LAYER;
  if (layer === "vendor") return createVendorIdFactory();
  if (layer === "app") return createAppIdFactory();
  let next = 0;
  const local = new Map();
  return (filePath) => {
    const existing = local.get(filePath);
    if (existing != null) return existing;
    next += 1;
    local.set(filePath, next);
    return next;
  };
}

/** Metro 给「启动时执行某个模块」生成一段虚拟脚本，路径是 require-<真实路径>。判断归属时按它指向的真实路径算：vendor 已经执行过的不再重复，入口模块的那一段要保留。 */
function processModuleFilter(module) {
  const layer = process.env.ZIJINHUA_LAYER;
  if (layer !== "app") return true;
  /** __prelude__ 只定义全局变量，vendor 主包里已经有了。 */
  if (module.path === "__prelude__") return false;
  /** polyfill 也是脚本（不是模块），同样在 vendor 里执行过，不重复。 */
  if (module.output?.[0]?.type?.startsWith("js/script") && !module.path.startsWith("require-")) return false;
  const target = module.path.startsWith("require-") ? module.path.slice("require-".length) : module.path;
  return !ownedPaths().has(moduleKey(target));
}

module.exports = { createModuleIdFactory, processModuleFilter, flushModuleMaps };
