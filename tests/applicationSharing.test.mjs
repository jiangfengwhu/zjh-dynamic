import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function moduleUrl(file, rewrite = source => source) {
  const source = rewrite(readFileSync(file, 'utf8'));
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  return 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
}
const sharingUrl = moduleUrl('packages/app-sdk/src/sharing.ts');
const sharing = await import(sharingUrl);
const linksUrl = moduleUrl('apps/mobile/src/shell/deepLinks.ts', source => source.replace('"../../../../packages/app-sdk/src/sharing"', JSON.stringify(sharingUrl)));
const links = await import(linksUrl);
const clipboardUrl = moduleUrl('apps/mobile/src/shell/clipboardShares.ts', source => source.replace(/^import .*;\r?\n/gm, '') + `\nimport {parseSharedLink, sharedLinkUrl} from ${JSON.stringify(linksUrl)};`);
const clipboard = await import(clipboardUrl);

test('cold and warm application entry preserves params, repeats events and isolates applications', async () => {
  const a = sharing.applicationSharing('app-a'), b = sharing.applicationSharing('app-b');
  sharing.receiveApplicationShare('app-a', { room: '初始' });
  assert.deepEqual(a.getParams(), { room: '初始' });
  assert.equal(b.getParams(), undefined);
  const events = [], other = [];
  const stop = a.subscribe(value => { events.push(value); if (value) value.room = 'mutated'; });
  const stopOther = a.subscribe(value => other.push(value));
  sharing.receiveApplicationShare('app-a', { room: '新房间' });
  sharing.receiveApplicationShare('app-a', { room: '新房间' });
  assert.equal(events.length, 0, 'application callbacks do not block navigation');
  await Promise.resolve();
  assert.equal(events.length, 2);
  assert.deepEqual(other, [{ room: '新房间' }, { room: '新房间' }]);
  assert.deepEqual(a.getParams(), { room: '新房间' });
  sharing.receiveApplicationShare('app-a'); await Promise.resolve();
  assert.equal(a.getParams(), undefined); assert.equal(events.at(-1), undefined);
  stop(); stopOther();
});
test('disposed subscribers are not delivered queued entry events', async () => {
  let called = false;
  sharing.applicationSharing('app-c').subscribe(() => { called = true; });
  sharing.receiveApplicationShare('app-c', { level: 3 });
  sharing.clearApplicationShareListeners('app-c');
  await Promise.resolve();
  assert.equal(called, false);
  assert.deepEqual(sharing.applicationSharing('app-c').getParams(), { level: 3 });
});
test('SDK panel input is a validated snapshot and opening does not send messages', async () => {
  let captured;
  sharing.setApplicationSharingHandler(async (id, input) => { captured = { id, input }; });
  const params = { level: 3, nested: ['😺', true] };
  await sharing.applicationSharing('app-a').open({ title: '挑战', params });
  params.nested[0] = 'changed';
  assert.equal(captured.id, 'app-a'); assert.deepEqual(captured.input.params, { level: 3, nested: ['😺', true] });
  await assert.rejects(sharing.applicationSharing('app-a').open({ params: { token: undefined } }));
});
test('external and clipboard links round-trip Unicode, apostrophes and URL delimiters', () => {
  const target = { kind: 'application', id: 'app-a', params: { item: "中文 😺 O'Brien !()* #&?", level: 3 } };
  const url = links.sharedLinkUrl(target);
  assert.deepEqual(links.parseSharedLink(url), target);
  assert.deepEqual(links.parseSharedLink(url.replace('https://zijinhua.297782.xyz/', 'zijinhua://')), target);
  assert.deepEqual(clipboard.parseClipboardShare(clipboard.createShareText(target, '来试试')), target);
  assert.equal(clipboard.parseClipboardShare(url + '\n' + links.sharedLinkUrl({ ...target, params: { level: 4 } })), undefined);
});
test('malformed, oversized and non-JSON params are rejected rather than dropped', () => {
  for (const query of ['p=invalid', 'p=null', 'p=%5B1%5D', 'p=%7B%7D&p=%7B%7D', 'p=' + encodeURIComponent(JSON.stringify({ text: '😺'.repeat(1024) }))]) assert.equal(links.parseSharedLink('https://zijinhua.297782.xyz/applications/app-a?' + query), undefined);
  for (const value of [{ n: NaN }, { n: Infinity }, { date: new Date() }, { fn() {} }, { x: '😺'.repeat(1024) }]) assert.throws(() => sharing.normalizeShareParams(value));
  const circular = {}; circular.self = circular; assert.throws(() => sharing.normalizeShareParams(circular));
  assert.equal(links.parseSharedLink('https://other.example/applications/app-a?p=%7B%7D'), undefined);
});
