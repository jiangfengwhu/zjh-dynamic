// Application bundles use Metro's factory format, but their module state belongs
// to one generation of one application, rather than the host's module registry.
type Module = { factory?: Factory; dependencies?: number[]; public: { id: number; exports: any }; state: "new" | "running" | "ready" | "failed"; error?: unknown; defaultValue?: any; allValue?: any; hasDefault?: boolean; hasAll?: boolean };
type Loader = ((id: number) => any) & { importDefault: (id: number) => any; importAll: (id: number) => any; [key: string]: any };
type Factory = (global: typeof globalThis, require: Loader, importDefault: Loader["importDefault"], importAll: Loader["importAll"], module: Module["public"], exports: any, dependencies: number[]) => void;
type Scope = { appId: string; base: number; size: number; modules: Map<number, Module>; require: Loader };
const scopes = new Map<string, Scope>();
const ranges = new Map<number, Scope>();
let rangeSize = 0;
let hostRequire: Loader;
let installed = false;
const globals = globalThis as typeof globalThis & { __r: Loader; __d: (...args: any[]) => void; __METRO_GLOBAL_PREFIX__?: string; [key: string]: any };
function owner(id: number) { return rangeSize ? ranges.get(Math.floor(id / rangeSize) * rangeSize) : undefined; }

export function installApplicationModuleLoader() {
  if (installed) return;
  hostRequire = globals.__r;
  const key = `${globals.__METRO_GLOBAL_PREFIX__ ?? ""}__d`;
  const define = globals[key];
  if (typeof hostRequire !== "function" || typeof define !== "function") throw new Error("应用模块加载器尚未就绪");
  globals[key] = (factory: Factory, id: number, dependencies: number[], ...rest: any[]) => {
    const scope = owner(id);
    if (!scope) { define(factory, id, dependencies, ...rest); return; }
    if (!scope.modules.has(id)) scope.modules.set(id, { factory, dependencies, public: { id, exports: {} }, state: "new" });
  };
  const require = ((id: number) => { const scope = owner(id); return scope ? scope.require(id) : hostRequire(id); }) as Loader;
  Object.assign(require, hostRequire);
  require.importDefault = id => { const scope = owner(id); return scope ? scope.require.importDefault(id) : hostRequire.importDefault(id); };
  require.importAll = id => { const scope = owner(id); return scope ? scope.require.importAll(id) : hostRequire.importAll(id); };
  globals.__r = require;
  installed = true;
}

export function createApplicationModuleScope(appId: string, base: number, size: number) {
  installApplicationModuleLoader();
  if (scopes.has(appId)) throw new Error(`应用模块尚未释放：${appId}`);
  if (!Number.isSafeInteger(base) || !Number.isSafeInteger(size) || size <= 0 || base % size || rangeSize && rangeSize !== size || ranges.has(base)) throw new Error("应用模块范围冲突");
  rangeSize = size;
  const modules = new Map<number, Module>();
  const require = ((id: number) => {
    if (id < base || id >= base + size) return hostRequire(id);
    const module = modules.get(id);
    if (!module) throw new Error(`应用模块不存在：${appId}/${id}`);
    if (module.state === "failed") throw module.error;
    if (module.state !== "new") return module.public.exports;
    module.state = "running";
    try {
      module.factory!(globalThis, require, require.importDefault, require.importAll, module.public, module.public.exports, module.dependencies!);
      module.state = "ready";
      module.factory = undefined; module.dependencies = undefined;
      return module.public.exports;
    } catch (error) { module.state = "failed"; module.error = error; throw error; }
  }) as Loader;
  Object.assign(require, hostRequire);
  require.importDefault = id => {
    if (id < base || id >= base + size) return hostRequire.importDefault(id);
    const exports = require(id), module = modules.get(id)!;
    if (!module.hasDefault) { module.defaultValue = exports?.__esModule ? exports.default : exports; module.hasDefault = true; }
    return module.defaultValue;
  };
  require.importAll = id => {
    if (id < base || id >= base + size) return hostRequire.importAll(id);
    const exports = require(id), module = modules.get(id)!;
    if (!module.hasAll) { module.allValue = exports?.__esModule ? exports : { ...exports, default: exports }; module.hasAll = true; }
    return module.allValue;
  };
  const scope = { appId, base, size, modules, require };
  scopes.set(appId, scope); ranges.set(base, scope);
}

export function releaseApplicationModuleScope(appId: string) {
  // Existing callbacks retain their own generation; they must never resolve new
  // modules under the same IDs. Application-owned cleanup remains optional.
  const scope = scopes.get(appId);
  if (scope) ranges.delete(scope.base);
  scopes.delete(appId);
}
