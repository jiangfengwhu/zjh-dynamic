import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function evaluate(file, globals) {
  const source = readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInContext(code, globals, { filename: file });
  return globals.exports;
}
function fixture() {
  const shared = { counter: 0 }, hostDefinitions = new Map();
  const host = id => { assert.equal(id, 1); return shared; };
  host.importDefault = host; host.importAll = host;
  const global = vm.createContext({ exports: {}, __r: host, __d: (factory, id) => hostDefinitions.set(id, factory), console });
  const api = evaluate('apps/mobile/src/runtime/applicationModules.ts', global);
  return { api, global, shared, hostDefinitions };
}
test('application modules reload independently while shared dependencies retain identity', () => {
  const { api, global: g, shared, hostDefinitions } = fixture();
  api.createApplicationModuleScope('a', 2000000, 100000); api.createApplicationModuleScope('b', 2100000, 100000);
  const factory = version => (global, require, _, __, module) => { module.exports = { version, shared: require(1), id: module.id }; };
  g.__d(factory('old'), 2000000, []); g.__d(factory('other'), 2100000, []);
  const other = g.__r(2100000), old = g.__r(2000000);
  shared.counter++;
  api.releaseApplicationModuleScope('a'); api.createApplicationModuleScope('a', 2000000, 100000);
  g.__d(factory('new'), 2000000, []);
  const next = g.__r(2000000);
  assert.equal(next.version, 'new'); assert.notEqual(next, old); assert.equal(next.shared, shared);
  assert.equal(next.id, 2000000); assert.equal(g.__r(2100000), other); assert.equal(next.shared.counter, 1);
  g.__d(() => {}, 123, []); assert.ok(hostDefinitions.has(123)); assert.equal(hostDefinitions.size, 1);
});
test('old callbacks resolve lazy modules from their own generation', () => {
  const { api, global: g } = fixture();
  const define = version => {
    g.__d((global, require, _, __, module) => { module.exports = () => require(2000001); }, 2000000, []);
    g.__d((global, require, _, __, module) => { module.exports = version; }, 2000001, []);
  };
  api.createApplicationModuleScope('a', 2000000, 100000); define('old'); const callback = g.__r(2000000);
  api.releaseApplicationModuleScope('a'); api.createApplicationModuleScope('a', 2000000, 100000); define('new');
  assert.equal(callback(), 'old'); assert.equal(g.__r(2000000)(), 'new');
});
test('module cycles, import helpers, undefined exports and failed partial bundles are isolated', () => {
  const { api, global: g } = fixture(); api.createApplicationModuleScope('a', 2000000, 100000);
  g.__d((global, require, _, __, module, exports) => { exports.name = 'a'; exports.b = require(2000001).name; }, 2000000, []);
  g.__d((global, require, _, __, module, exports) => { exports.name = 'b'; exports.a = require(2000000).name; }, 2000001, []);
  assert.equal(g.__r(2000000).b, 'b'); assert.equal(g.__r(2000001).a, 'a');
  g.__d((global, require, _, __, module) => { module.exports = { __esModule: true, default: 'default' }; }, 2000002, []);
  assert.equal(g.__r.importDefault(2000002), 'default'); assert.equal(g.__r.importAll(2000002), g.__r(2000002));
  g.__d((global, require, _, __, module) => { module.exports = undefined; }, 2000003, []);
  assert.equal(g.__r(2000003), undefined);
  let attempts = 0; g.__d(() => { attempts++; throw Error('partial'); }, 2000004, []);
  assert.throws(() => g.__r(2000004), /partial/); assert.throws(() => g.__r(2000004), /partial/); assert.equal(attempts, 1);
  api.releaseApplicationModuleScope('a'); api.createApplicationModuleScope('a', 2000000, 100000);
  g.__d((global, require, _, __, module) => { module.exports = 'fixed'; }, 2000004, []);
  assert.equal(g.__r(2000004), 'fixed');
  assert.throws(() => api.createApplicationModuleScope('overlap', 2000010, 100), /范围冲突/);
});

function runtime() {
  const state = { data: new Map(), definitions: new Map(), disposals: [], executions: [], fail: new Set(), owner: null };
  const callbacks = {};
  const { api: modules, global: g } = fixture();
  Object.assign(g, {
    exports: {}, require: path => path.includes('allocations') ? { applications: {}, moduleRangeSize: 100000 } : path.includes('application-contract') ? { sdk: '2.2.4' } : path.includes('build-identity') ? { buildId: 'test-host' } : { defaultApplication: 'jolly' },
    subscribeAccountIdentity: listener => { callbacks.account = listener; }, onApplicationPageAttempt: listener => { callbacks.attempt = listener; }, onApplicationPageReady: listener => { callbacks.ready = listener; },
    cachedAccountId: () => state.owner, currentAccountId: async () => state.owner, restoreWorks: async () => {},
    readShellValue: async key => state.data.get(key), readShellValueSync: key => state.data.get(key), writeShellValue: (key, value) => state.data.set(key, value),
    loadCatalog: async () => state.catalog ?? [], loadCatalogSync: () => state.catalog ?? [], saveCatalog: async value => { state.catalog = value; },
    AbortController, setTimeout, clearTimeout, fetch: async () => ({ ok: true, json: async () => ({ applications: (state.catalog ?? []).map(item => ({ appId: item.id, manifest: state.publicManifest ?? null })) }) }),
    downloadApplicationResources: async manifest => { state.downloads = (state.downloads ?? 0) + 1; if (state.downloadPause) await state.downloadPause; }, edgeUrl: 'https://example.test',
    assertApplicationSdkCompatible: () => {}, createApplicationModuleScope: modules.createApplicationModuleScope, releaseApplicationModuleScope: modules.releaseApplicationModuleScope,
    disposeApplication: async id => { state.disposals.push(id); state.definitions.delete(id); }, applicationContext: id => ({ appId: id }),
    peekRegisteredApplication: id => state.definitions.get(id), activateApplication: () => {}, installApplicationAssets: () => {},
    NativePluginHost: { call: async (_, method, payload) => {
      assert.equal(method, 'loadApplication', 'single application operations must never reload ReactHost');
      const manifest = JSON.parse(payload); state.executions.push([manifest.appId, manifest.releaseId]);
      if (state.pause) await state.pause;
      g.__d((global, require, _, __, module) => { module.exports = manifest.releaseId; }, manifest.modules.base, []);
      if (state.fail.has(manifest.releaseId)) throw Error('bad bundle');
      assert.equal(g.__r(manifest.modules.base), manifest.releaseId);
      state.definitions.set(manifest.appId, { main: () => () => null }); return JSON.stringify({ assets: {} });
    } },
  });
  const api = evaluate('apps/mobile/src/runtime/applications.ts', g);
  function manifest(id, version, base = 2000000) { return { format: 1, appId: id, releaseId: version.repeat(64), sdk: '2.2.4', source: { commit: 'c'.repeat(40), dirty: false }, bundle: { sha256: version.repeat(64) }, modules: { base, size: 100000 } }; }
  function install(item) { state.data.set(`application.install.${item.appId}`, JSON.stringify(item)); state.data.set(`application.access.${item.appId}`, JSON.stringify({ releaseId: item.releaseId, public: true, ownerId: null })); }
  function stage(item) { state.data.set(`application.pending.${item.appId}`, JSON.stringify(item)); state.data.set(`application.pending.access.${item.appId}`, JSON.stringify({ releaseId: item.releaseId, public: true, ownerId: null })); }
  return { state, api, manifest, install, stage, callbacks };
}
test('replacement and uninstall affect only their application and keep persisted business data', async () => {
  const f = runtime(); const a = f.manifest('a', 'a'), b = f.manifest('b', 'b', 2100000), next = f.manifest('a', 'd');
  f.install(a); f.install(b); f.state.data.set('business:a:score', '10');
  await f.api.loadApplication('a'); await f.api.loadApplication('b'); f.stage(next);
  await Promise.all([f.api.reloadApplication('a'), f.api.reloadApplication('a')]);
  assert.equal(f.api.runningApplication('a').releaseId, next.releaseId);
  assert.equal(f.api.runningApplication('b').releaseId, b.releaseId); assert.equal(f.api.applicationLoaded('b'), true);
  assert.equal(f.state.executions.filter(([id]) => id === 'a').length, 2); assert.deepEqual(f.state.disposals, ['a']);
  assert.equal(f.state.data.get('business:a:score'), '10'); await f.api.unloadApplication('a');
  assert.equal(f.api.applicationLoaded('a'), false); assert.equal(f.api.applicationLoaded('b'), true);
});
test('failed replacement restores old modules locally and a corrected version can retry', async () => {
  const f = runtime(); const old = f.manifest('a', 'a'), bad = f.manifest('a', 'b'), fixed = f.manifest('a', 'd');
  f.install(old); await f.api.loadApplication('a'); f.stage(bad); f.state.fail.add(bad.releaseId);
  await assert.rejects(f.api.reloadApplication('a'), /bad bundle/);
  assert.equal(f.api.applicationLoaded('a'), true); assert.equal(f.api.runningApplication('a').releaseId, old.releaseId);
  assert.equal(f.state.data.get('application.failed.a'), bad.releaseId);
  f.stage(fixed); await f.api.reloadApplication('a'); assert.equal(f.api.runningApplication('a').releaseId, fixed.releaseId);
});
test('failed first load releases partial modules and delayed errors cannot blacklist a new version', async () => {
  const f = runtime(), bad = f.manifest('a', 'b'), fixed = f.manifest('a', 'd');
  f.stage(bad); f.state.fail.add(bad.releaseId); await assert.rejects(f.api.loadApplication('a'), /bad bundle/);
  assert.equal(f.api.applicationLoaded('a'), false); f.stage(fixed); await f.api.reloadApplication('a');
  await f.api.reportApplicationFailure('a', bad.releaseId); assert.equal(f.api.runningApplication('a').releaseId, fixed.releaseId);
});

test('uninstall queued during replacement leaves the target unloaded', async () => {
  const f = runtime(), old = f.manifest('a', 'a'), next = f.manifest('a', 'd');
  f.install(old); await f.api.loadApplication('a'); f.stage(next);
  let resume; f.state.pause = new Promise(resolve => { resume = resolve; });
  const replacement = f.api.reloadApplication('a'); await new Promise(resolve => setImmediate(resolve));
  const removal = f.api.unloadApplication('a'); resume(); await Promise.all([replacement, removal]);
  assert.equal(f.api.applicationLoaded('a'), false); assert.equal(f.api.runningApplication('a'), undefined);
});

test('unchanged Metro split-bundle factory format registers into the application container', () => {
  const { api, global: g, shared } = fixture(); const registered = [];
  g.__zijinhuaApplications = { register: (id, definition) => registered.push([id, definition]), require: () => shared };
  const source = version => `__d(function(g,r,i,a,m,e,d){globalThis.__zijinhuaApplications.register("a",r(d[0]).default)},2000000,[2000001]);
    __d(function(g,r,i,a,m,e,d){e.default={version:"${version}",shared:r(d[0])}},2000001,[2000002]);
    __d(function(g,r,i,a,m,e,d){m.exports=globalThis.__zijinhuaApplications.require("react","a")},2000002,[]);__r(2000000);`;
  api.createApplicationModuleScope('a', 2000000, 100000); vm.runInContext(source('old'), g);
  api.releaseApplicationModuleScope('a'); api.createApplicationModuleScope('a', 2000000, 100000); vm.runInContext(source('new'), g);
  assert.equal(registered[0][1].version, 'old'); assert.equal(registered[1][1].version, 'new');
  assert.equal(registered[0][1].shared, registered[1][1].shared);
});

test('SDK activates after assets are installed, disposes only the target, and keeps stable page registration', async () => {
  const registered = [], cleared = [], data = new Map(), events = [], cleanup = [];
  const g = vm.createContext({ exports: {}, console, setTimeout, clearTimeout, requestAnimationFrame: callback => setImmediate(callback),
    require: () => ({ defaultApplication: 'jolly' }), registerFeature: (id, page) => registered.push([id, page]),
    applicationCapabilities: () => ({}), applicationData: () => ({ storage: { get: key => data.get(key), set: (key, value) => data.set(key, value) } }),
    applicationSharing: () => ({}), clearApplicationShareListeners: () => {},
    applicationCloud: () => ({}), applicationAuth: {}, applicationAi: () => ({}), phone: {},
    clearApplicationQueries: id => cleared.push(id),
  });
  const api = evaluate('packages/app-sdk/src/runtime.ts', g);
  const first = { main: () => () => null, onDispose: context => { cleanup.push(context.appId); assert.equal(context.storage.get('score'), '10'); } };
  api.subscribeApplicationRuntime('a', () => events.push(api.applicationRuntimeSnapshot('a')));
  api.registerApplication('a', first); assert.equal(events.length, 0); assert.equal(api.applicationRuntimeSnapshot('a'), undefined);
  api.installApplicationAssets('a', { icon: 'file://old' }); api.activateApplication('a');
  assert.equal(events.length, 1); const old = events[0];
  api.applicationContext('a').storage.set('score', '10');
  api.registerApplication('b', { main: () => () => null }); api.activateApplication('b'); const other = api.applicationRuntimeSnapshot('b');
  await api.disposeApplication('a'); assert.deepEqual(cleanup, ['a']); assert.deepEqual(cleared, ['a']);
  assert.equal(events.at(-1), undefined); assert.equal(api.peekRegisteredApplication('a'), undefined);
  assert.equal(api.applicationRuntimeSnapshot('b'), other); assert.equal(data.get('score'), '10');
  api.registerApplication('a', { main: () => () => null }); api.activateApplication('a');
  assert.notEqual(api.applicationRuntimeSnapshot('a').generation, old.generation);
  assert.equal(registered.filter(([id]) => id === 'a').length, 1);
  await api.disposeApplication('a'); assert.deepEqual(cleanup, ['a'], 'onDispose is optional');
});

test('silent public updates download and replace only their application immediately', async () => {
  const f = runtime(), old = f.manifest('a', 'a'), next = f.manifest('a', 'd'), other = f.manifest('b', 'b', 2100000);
  f.install(old); f.install(other); f.state.catalog = [{ id: 'a' }]; f.state.publicManifest = next;
  await f.api.loadApplication('a'); await f.api.loadApplication('b');
  f.state.data.set('business:a:score', '10');
  await Promise.all([f.api.updatePublicApplicationsSilently(), f.api.updatePublicApplicationsSilently()]);
  assert.equal(f.api.runningApplication('a').releaseId, next.releaseId);
  assert.equal(f.api.runningApplication('b').releaseId, other.releaseId);
  assert.deepEqual(f.state.disposals, ['a']); assert.equal(f.state.downloads, 1);
  assert.equal(f.state.data.get('business:a:score'), '10');
  assert.equal(f.state.data.get('application.public-update.a'), undefined, 'no separate prepared-version store');
});
test('private selection, uninstall or account change during silent download wins', async () => {
  for (const change of ['private', 'uninstall', 'account']) {
    const f = runtime(), old = f.manifest('a', 'a'), next = f.manifest('a', 'd');
    f.install(old); f.state.catalog = [{ id: 'a' }]; f.state.publicManifest = next;
    let resume; f.state.downloadPause = new Promise(resolve => { resume = resolve; });
    const updating = f.api.updatePublicApplicationsSilently(); const handled = updating.catch(error => error);
    await new Promise(resolve => setImmediate(resolve));
    if (change === 'private') { f.stage(f.manifest('a', 'b')); f.state.data.set('application.pending.access.a', JSON.stringify({ ownerId: 'owner', public: false })); }
    if (change === 'uninstall') f.state.catalog = [{ id: 'a', purged: true }];
    if (change === 'account') f.state.owner = 'new-account';
    resume(); const result = await handled;
    if (change === 'account') assert.match(result.message, /账号已改变/);
    assert.equal(f.state.executions.length, 0);
    if (change === 'private') assert.equal(JSON.parse(f.state.data.get('application.pending.a')).releaseId, 'b'.repeat(64));
    else assert.equal(f.state.data.get('application.pending.a'), undefined);
  }
});
test('platform update checks and apply never mix in public application updates', async () => {
  const calls = [];
  const g = vm.createContext({ exports: {}, console, AbortSignal,
    require: () => ({ buildId: 'host', apk: { versionCode: 1 } }), edgeUrl: 'https://example.test',
    fetch: async () => ({ ok: true, json: async () => ({ release: { id: 'release', source: { buildId: 'host' } } }) }),
    NativePluginHost: { call: async (_, method) => { calls.push(method); return JSON.stringify(method === 'checkUpdates' ? { items: [{ kind: 'application', id: 'dinner', sha256: 'a', bytes: 1 }] } : { applied: 1 }); } },
    checkApplicationUpdates: () => { throw Error('must not include application updates'); }, stageApplicationUpdates: () => { throw Error('must not apply application updates'); },
  });
  const api = evaluate('apps/mobile/src/shell/packageUpdates.ts', g);
  assert.equal((await api.checkPackageUpdates()).length, 0); assert.equal(await api.applyPackageUpdates([]), 1);
  assert.deepEqual(calls, ['checkUpdates', 'applyUpdates']);
});
