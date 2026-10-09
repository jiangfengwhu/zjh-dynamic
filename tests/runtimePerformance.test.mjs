import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function moduleAt(file, dependencies, functionName) {
  let source = readFileSync(file, 'utf8');
  if (functionName) {
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    source = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === functionName).getText(tree);
  } else source = source.replace(/^import .*;\r?\n/gm, '');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function(...Object.keys(dependencies), 'exports', code)(...Object.values(dependencies), exports);
  return exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const manifest = id => ({ appId: id, releaseId: id, source: { commit: 'commit' }, bundle: { bytes: 1 }, assets: [] });

test('download scheduler reserves foreground capacity and joins identical work', async () => {
  const requests = [];
  const { downloadApplicationResources: download } = moduleAt('apps/mobile/src/runtime/applicationDownloads.ts', {
    NativePluginHost: { call: (_, method, payload) => { assert.equal(method, 'prepareApplication'); const task = deferred(); requests.push({ ...task, id: JSON.parse(payload).appId }); return task.promise; } },
  });
  const a = manifest('a'), pending = [download(a, undefined, 'update'), download(manifest('b'), undefined, 'update'), download(manifest('c'), undefined, 'update')];
  assert.deepEqual(requests.map(item => item.id), ['a', 'b']);
  const joined = download(a), visible = download(manifest('visible'));
  assert.deepEqual(requests.map(item => item.id), ['a', 'b', 'visible']);
  requests[0].resolve(); await tick();
  assert.equal(requests.length, 3); // c still leaves a foreground slot available.
  requests[1].resolve(); await tick(); assert.equal(requests[3].id, 'c');
  requests[2].resolve(); requests[3].resolve();
  await Promise.all([...pending, joined, visible]);
  await download(a); assert.equal(requests.length, 4);
});

function staging() {
  const state = { owner: 'owner', catalog: ['a', 'b', 'c'].map(id => ({ id })), writes: new Map(), requests: [] };
  const offered = new Map(state.catalog.map(({ id }) => [id, { manifest: manifest(id), ownerId: null }]));
  const { stageApplicationUpdates: stage } = moduleAt('apps/mobile/src/runtime/applications.ts', {
    loadCatalog: async () => structuredClone(state.catalog), cachedAccountId: () => state.owner, offered, active: new Map(),
    verifyCandidateAccess: async () => {}, downloadApplicationResources: (item, signal, priority) => { assert.equal(priority, 'update'); const task = deferred(); state.requests.push({ ...task, id: item.appId }); return task.promise; },
    writeShellValue: (key, value) => state.writes.set(key, value), saveCatalog: async value => { state.catalog = value; },
  }, 'stageApplicationUpdates');
  return { state, offered, stage };
}

test('parallel staging keeps successes and excludes failures or superseded offers', async () => {
  const { state, offered, stage } = staging(); const result = stage(); await tick();
  assert.equal(state.requests.length, 3);
  offered.set('c', { manifest: { ...manifest('c'), releaseId: 'newer' }, ownerId: null });
  state.requests[0].resolve(); state.requests[1].reject(Error('network')); state.requests[2].resolve();
  await assert.rejects(result, /已准备 1 个更新/);
  assert.ok(state.writes.has('application.pending.a'));
  assert.equal(state.writes.has('application.pending.b'), false);
  assert.equal(state.writes.has('application.pending.c'), false);
});

test('staging does not revive explicit uninstall or commit under a changed account', async () => {
  let fixture = staging(); let result = fixture.stage('a'); await tick();
  fixture.state.catalog[0].trashedAt = 10; fixture.state.requests[0].resolve();
  assert.equal(await result, 0); assert.equal(fixture.state.writes.size, 0);
  fixture = staging(); result = fixture.stage(); await tick(); fixture.state.owner = 'other';
  fixture.state.requests.forEach(task => task.resolve()); await assert.rejects(result, /账号已改变/);
  assert.equal(fixture.state.writes.size, 0);
});

function aiFixture() {
  let listener, sequence = 0; const frames = new Map(), requests = [], cancelled = [];
  const { applicationAi } = moduleAt('packages/app-sdk/src/ai.ts', {
    aiMessages: value => value, DeviceEventEmitter: { addListener: (_, callback) => { listener = callback; return { remove() { listener = undefined; } }; } },
    prepareAiRequest: async () => ({ ok: true, providerId: 'provider', path: '', stream: true, body: {} }),
    shell: (method, input) => { if (method === 'completeCancel') { cancelled.push(input.requestId); return Promise.resolve({ ok: true }); } const task = deferred(); requests.push({ ...task, id: input.requestId }); return task.promise; },
    requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id; }, cancelAnimationFrame: id => frames.delete(id),
  });
  return { ai: applicationAi(() => {}), requests, cancelled, frames, emit: delta => listener?.({ requestId: requests.at(-1).id, delta }), frame: () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); } };
}

test('AI merges bursts per frame, flushes final text and cancels pending display', async () => {
  const f = aiFixture(), displayed = [];
  const result = f.ai.stream({ messages: [{ role: 'user', content: 'hello' }] }, { onText: text => displayed.push(text) }); await tick();
  f.emit('a'); f.emit('b'); assert.deepEqual(displayed, []); f.frame(); assert.deepEqual(displayed, ['ab']);
  f.emit('c'); f.requests[0].resolve({ ok: true, text: 'abcd', model: 'model', providerId: 'provider' });
  assert.equal((await result).ok, true); assert.deepEqual(displayed, ['ab', 'abcd']); assert.equal(f.frames.size, 0);
  const controller = new AbortController(); const aborted = f.ai.stream({ messages: [{ role: 'user', content: 'hello' }] }, { signal: controller.signal, onText: text => displayed.push(text) }); await tick();
  f.emit('hidden'); controller.abort(); assert.equal((await aborted).code, 'CANCELLED'); f.frame(); assert.deepEqual(displayed, ['ab', 'abcd']);
  f.requests[1].resolve({ ok: false, code: 'CANCELLED' }); await tick(); assert.equal(f.cancelled.length, 1);
});

test('AI callback errors cancel generation and report an explicit failure', async () => {
  const f = aiFixture(); const result = f.ai.stream({ messages: [{ role: 'user', content: 'hello' }] }, { onText() { throw Error('render'); } }); await tick();
  f.emit('a'); f.frame(); assert.equal((await result).code, 'INVALID_REQUEST');
  f.requests[0].resolve({ ok: false, code: 'CANCELLED' }); await tick(); assert.equal(f.frames.size, 0);
});

test('catalog caches parsing but preserves independent mutable snapshots and external writes', () => {
  let raw = JSON.stringify({ entries: [{ id: 'a', pinned: true }] }), parses = 0;
  const { loadCatalogSync } = moduleAt('apps/mobile/src/shell/catalog.ts', {
    readShellValueSync: () => raw, writeShellValue: (_, value) => { raw = value; },
    JSON: { parse: value => { parses++; return JSON.parse(value); }, stringify: JSON.stringify },
  });
  loadCatalogSync()[0].pinned = false; assert.equal(loadCatalogSync()[0].pinned, true); assert.equal(parses, 1);
  raw = JSON.stringify({ entries: [{ id: 'b' }] }); assert.equal(loadCatalogSync()[0].id, 'b'); assert.equal(parses, 2);
});
