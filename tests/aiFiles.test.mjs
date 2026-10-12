import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function load(path) {
  const source = readFileSync(path, 'utf8').replace(/^import .*;\r?\n/gm, '');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('exports', code)(exports);
  return exports;
}
const { aiMessages } = load('packages/app-sdk/src/ai-input.ts');
const { aiRequestBody } = load('packages/platform/src/aiRequest.ts');
const data = Buffer.from('file bytes').toString('base64');
const input = attachments => ({ messages: aiMessages([{ role: 'user', content: '分析文件', attachments }]) });

test('Word, spreadsheets and future MIME types use Responses without a format whitelist', () => {
  for (const [name, mime] of [['简历.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['成绩.csv', 'text/csv'], ['data.custom', 'application/x-custom']]) {
    const body = aiRequestBody({ ...input([{ type: 'file', name, mime, data }]), maxTokens: 100 }, 'model', true);
    assert.equal(body.store, false);
    assert.equal(body.max_output_tokens, 100);
    assert.deepEqual(body.input[0].content[1], { type: 'input_file', filename: name, file_data: `data:${mime};base64,${data}` });
    assert.equal(body.messages, undefined);
  }
});
test('provider file IDs and HTTPS URLs are supported; URL cannot use Chat Completions', () => {
  const request = input([{ type: 'file', fileId: 'file-existing' }, { type: 'file', url: 'https://example.com/file.xlsx' }]);
  const body = aiRequestBody(request, 'model', false);
  assert.deepEqual(body.input[0].content.slice(1), [{ type: 'input_file', file_id: 'file-existing' }, { type: 'input_file', file_url: 'https://example.com/file.xlsx' }]);
  assert.throws(() => aiRequestBody({ ...request, protocol: 'chat-completions' }, 'model', false), /Responses/);
  assert.throws(() => input([{ type: 'file', url: 'http://example.com/file.xlsx' }]), /HTTPS/);
});
test('ambiguous sources, invalid names/base64 and requests over the media limit fail before transport', () => {
  assert.throws(() => input([{ type: 'file', name: 'a.pdf', mime: 'application/pdf', data, fileId: 'file-1' }]), /只能/);
  assert.throws(() => input([{ type: 'file', name: '../a.pdf', mime: 'application/pdf', data }]), /文件名/);
  assert.throws(() => input([{ type: 'file', name: 'a.pdf', mime: 'application/pdf', data: 'data:application/pdf;base64,QQ==' }]), /base64/);
  assert.throws(() => input([{ type: 'file', name: 'a.pdf', mime: 'application/pdf', data: 'A'.repeat(8 * 1024 * 1024 + 4) }]), /base64/);
});
test('plain text and existing audio stay on Chat Completions; explicit PDF chat input remains available', () => {
  assert.deepEqual(aiRequestBody({ messages: aiMessages([{ role: 'user', content: 'hello' }]) }, 'model', false), { model: 'model', messages: [{ role: 'user', content: 'hello' }], stream: false });
  const audio = input([{ type: 'audio', data, format: 'wav' }]);
  assert.equal(aiRequestBody(audio, 'model', false).messages[0].content[1].type, 'input_audio');
  assert.throws(() => aiRequestBody({ ...audio, protocol: 'responses' }, 'model', false), /音频/);
  const file = input([{ type: 'file', name: 'resume.pdf', mime: 'application/pdf', data }]);
  assert.equal(aiRequestBody({ ...file, protocol: 'chat-completions' }, 'model', false).messages[0].content[1].file.filename, 'resume.pdf');
});
