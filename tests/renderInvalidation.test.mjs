import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function compileFunction(file, name) {
  const source = readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const node = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
  return ts.transpileModule(node.getText(tree), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
}

test('account revalidation avoids global broadcasts but profile and identity changes still propagate', () => {
  const notifications = [], identities = [], scopes = [];
  const user = { id: 'owner', email: null, name: 'Owner', avatarUrl: null, createdAt: 1 };
  const fixture = new Function('listeners', 'identityListeners', 'setApplicationAccountScope', 'initial', `
    let state = initial;
    ${compileFunction('apps/mobile/src/shell/account.ts', 'emit')}
    return { emit, snapshot: () => state };
  `)(new Set([next => notifications.push(next)]), new Set([id => identities.push(id)]), scope => scopes.push(scope), { user, ready: true, storageError: false });
  const initial = fixture.snapshot();
  fixture.emit({ user: { ...user }, ready: true, storageError: false });
  assert.equal(fixture.snapshot(), initial);
  assert.equal(notifications.length, 0);
  fixture.emit({ user: { ...user }, ready: true, storageError: true });
  assert.equal(fixture.snapshot().user, user);
  fixture.emit({ user: { ...user, name: 'Updated' }, ready: true, storageError: false });
  assert.equal(notifications.length, 2);
  assert.equal(identities.length, 0);
  assert.equal(fixture.snapshot().user.name, 'Updated');
  fixture.emit({ user: null, ready: true, storageError: false });
  fixture.emit({ user: { ...user, id: 'another-owner' }, ready: true, storageError: false });
  assert.deepEqual(identities, [null, 'another-owner']);
  assert.deepEqual(scopes.slice(-2), [null, 'another-owner']);
});

test('stable UI callbacks use latest committed state without exposing an abandoned render', async () => {
  let reference, callback, pending;
  const exports = {};
  const code = compileFunction('apps/mobile/src/shell/useEventCallback.ts', 'useEventCallback');
  new Function('exports', 'useRef', 'useCallback', 'useLayoutEffect', code)(exports,
    value => reference ??= { current: value },
    value => callback ??= value,
    effect => { pending = effect; });
  const first = exports.useEventCallback(value => `first:${value}`); pending();
  const second = exports.useEventCallback(value => `second:${value}`);
  assert.equal(first, second);
  assert.equal(first('tap'), 'first:tap');
  pending();
  assert.equal(first('tap'), 'second:tap');
  exports.useEventCallback(value => `abandoned:${value}`);
  assert.equal(first('tap'), 'second:tap');
  exports.useEventCallback(async value => `final:${value}`); pending();
  assert.equal(await first('tap'), 'final:tap');
});

test('inactive feed subscriptions pause and recover current data without exposing the previous account', () => {
  let owner = 'first-owner', cursor = 0, effects = [], writes = 0;
  const slots = [], listeners = new Set();
  const useState = initial => {
    const index = cursor++;
    if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
    return [slots[index].value, next => { const result = typeof next === 'function' ? next(slots[index].value) : next; if (result !== slots[index].value) { slots[index].value = result; writes++; } }];
  };
  const useEffect = (effect, dependencies) => {
    const index = cursor++, previous = slots[index];
    if (previous && dependencies.every((value, i) => value === previous.dependencies[i])) return;
    effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() }; });
  };
  const initial = { posts: [{ id: 'first-post' }], nextCursor: null };
  const fixture = new Function('useState', 'useEffect', 'cachedAccountId', 'listeners', 'currentAccountId', 'initial', `
    const exports = {}; let value = initial;
    const followingPage = { posts: [], nextCursor: null };
    ${compileFunction('apps/mobile/src/shell/feed/userPosts.ts', 'useUserPosts')}
    return { read: exports.useUserPosts, emit(next) { value = next; listeners.forEach(listener => listener(value)); } };
  `)(useState, useEffect, () => owner, listeners, async () => owner, initial);
  const render = active => { cursor = 0; effects = []; const result = fixture.read('recommended', active); effects.forEach(effect => effect()); return result; };
  render(true); assert.equal(listeners.size, 1);
  render(false); assert.equal(listeners.size, 0);
  const before = writes, latest = { posts: [{ id: 'new-post' }], nextCursor: null };
  fixture.emit(latest); assert.equal(writes, before);
  render(true); assert.equal(render(true), latest);
  render(false); owner = 'second-owner';
  const second = { posts: [], nextCursor: null }; fixture.emit(second);
  assert.equal(render(false), second);
  render(true); assert.equal(render(true), second);
});

test('relative timestamps share one clock and stop it after the last subscriber leaves', () => {
  const listeners = new Set(); let created = 0, cleared = 0, callback; const updates = [];
  const subscribe = new Function('listeners', 'setInterval', 'clearInterval', `let timer; ${compileFunction('apps/mobile/src/shell/feed/RelativeTime.tsx', 'subscribe')} return subscribe;`)(listeners, fn => { created++; callback = fn; return 1; }, () => cleared++);
  const leaveFirst = subscribe(() => updates.push('first'));
  const leaveSecond = subscribe(() => updates.push('second'));
  assert.equal(created, 1); callback(); assert.deepEqual(updates, ['first', 'second']);
  leaveFirst(); callback(); assert.deepEqual(updates, ['first', 'second', 'second']); assert.equal(cleared, 0);
  leaveSecond(); assert.equal(cleared, 1); assert.equal(listeners.size, 0);
  const leaveThird = subscribe(() => {}); assert.equal(created, 2); leaveThird(); assert.equal(cleared, 2);
});

function socialPageFixture() {
  let owner = 'first', cursor = 0, effects = [];
  const slots = [], cache = new Map(), requests = [], appListeners = new Set();
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const bindings = {
    exports: {},
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, next => { slots[index].value = typeof next === 'function' ? next(slots[index].value) : next; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback(fn, deps) {
      const index = cursor++;
      if (!same(slots[index]?.deps, deps)) slots[index] = { value: fn, deps };
      return slots[index].value;
    },
    useEffect(setup, deps) {
      const index = cursor++, previous = slots[index];
      if (same(previous?.deps, deps)) return;
      effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, setup, cleanup: setup() }; });
    },
    AppState: { currentState: 'active', addEventListener(_, callback) { appListeners.add(callback); return { remove: () => appListeners.delete(callback) }; } },
    useAccount: () => ({ user: { id: owner } }),
    useIsFocused: () => true,
    useRouteRequestReady: () => true,
    pageCacheKey: name => `${owner}:${name}`,
    cachedPage: key => cache.get(key),
    rememberPage: (key, value) => { cache.set(key, value); return value; },
    afterInteractions: () => () => {},
    waitForRouteTransitions: async () => {},
    requestAnimationFrame: () => 1,
    cancelAnimationFrame: () => {},
  };
  new Function(...Object.keys(bindings), compileFunction('apps/mobile/src/shell/social/useSocialPage.ts', 'useSocialPage'))(...Object.values(bindings));
  const read = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  const render = () => {
    cursor = 0; effects = [];
    const query = bindings.exports.useSocialPage({ name: 'relations', empty: { authors: [], nextCursor: null }, read, merge: (_, next) => next });
    effects.forEach(effect => effect()); return query;
  };
  return { render, requests, cache,
    owner(value) { owner = value; },
    foreground(value) { bindings.AppState.currentState = value ? 'active' : 'background'; appListeners.forEach(listener => listener(bindings.AppState.currentState)); },
    replay() { const current = slots.filter(slot => slot.setup); current.forEach(slot => slot.cleanup?.()); current.forEach(slot => { slot.cleanup = slot.setup(); }); },
  };
}

test('social requests and retained callbacks cannot overwrite another account or finish its request', async () => {
  const f = socialPageFixture(), first = f.render(), pending = first.load();
  f.owner('second');
  first.commit({ authors: [{ id: 'stale' }], nextCursor: null });
  assert.equal(f.cache.has('first:relations'), false);
  assert.equal(await first.load(), false);
  const second = f.render(), next = second.load();
  first.update(() => ({ authors: [{ id: 'wrong-account' }], nextCursor: null }));
  f.requests[0].resolve({ authors: [{ id: 'first' }], nextCursor: null });
  assert.equal(await pending, false);
  assert.equal(f.render().loading, true);
  assert.equal(f.cache.has('second:relations'), false);
  f.requests[1].resolve({ authors: [{ id: 'second' }], nextCursor: null });
  assert.equal(await next, true);
  assert.equal(f.render().data.authors[0].id, 'second');
});

test('social page ignores obsolete failures and pauses requests in the background', async () => {
  const f = socialPageFixture(), pending = f.render().load();
  f.owner('second'); f.render();
  f.requests[0].reject(new Error('old-account failure'));
  assert.equal(await pending, false);
  assert.equal(f.render().error, '');
  f.foreground(false);
  assert.equal(await f.render().load(), false);
  assert.equal(f.requests.length, 1);
  f.foreground(true);
  const resumed = f.render().load();
  f.requests[1].resolve({ authors: [], nextCursor: null });
  assert.equal(await resumed, true);
});

test('social acknowledgements win over an earlier fetch and effects can reconnect safely', async () => {
  const f = socialPageFixture(), query = f.render(), pending = query.load();
  query.update(() => ({ authors: [{ id: 'author', following: true }], nextCursor: null }));
  f.requests[0].resolve({ authors: [{ id: 'author', following: false }], nextCursor: null });
  assert.equal(await pending, false);
  assert.equal(f.render().data.authors[0].following, true);
  assert.equal(f.requests.length, 2);
  f.replay();
  const reconnected = f.render().load();
  f.requests[1].resolve({ authors: [{ id: 'author', following: false }], nextCursor: null });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.render().loading, true);
  f.requests[2].resolve({ authors: [{ id: 'author', following: true }], nextCursor: null });
  assert.equal(await reconnected, true);
  assert.equal(f.render().data.authors[0].following, true);
});
