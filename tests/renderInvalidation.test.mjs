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
