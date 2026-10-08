import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const identityListeners = new Set();
const profileListeners = new Set();
const state = {
  user: { id: "alice", name: "Alice", avatarUrl: null },
  cachedApplicationUser: () => state.user,
  requireAccount: async () => !!state.user,
  subscribeAccountIdentity: listener => { identityListeners.add(listener); return () => identityListeners.delete(listener); },
  subscribeApplicationUser: listener => { profileListeners.add(listener); return () => profileListeners.delete(listener); },
  accountFetch: async () => { throw new Error("unexpected network request"); },
};
globalThis.__cloudTestAccount = state;
const bundled = await build({
  stdin: { contents: 'export * from "../../packages/app-sdk/src/cloud"; export * from "../../apps/mobile/src/runtime/applicationCloud";', resolveDir: new URL(".", import.meta.url).pathname.replace(/^\/(.:\/)/, "$1"), loader: "ts" },
  bundle: true, platform: "node", format: "esm", write: false,
  plugins: [{ name: "host-account", setup(builder) {
    builder.onResolve({ filter: /^\.\.\/shell\/account$/ }, () => ({ path: "account", namespace: "test" }));
    builder.onResolve({ filter: /^\.\.\/shell\/evolveHost$/ }, () => ({ path: "edge", namespace: "test" }));
    builder.onLoad({ filter: /.*/, namespace: "test" }, args => ({ contents: args.path === "edge" ? 'export const edgeUrl="https://test";' : `const s=globalThis.__cloudTestAccount; ${Object.keys(state).filter(key => key !== "user").map(key => `export const ${key}=(...args)=>s.${key}(...args);`).join("\n")}` }));
  } }],
});
const sdk = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
sdk.installApplicationCloud();

test("auth uses cached public profile without network and subscriptions can be removed", async () => {
  assert.deepEqual(sdk.applicationAuth.getUser(), state.user);
  const copy = sdk.applicationAuth.getUser(); copy.name = "changed";
  assert.equal(state.user.name, "Alice");
  assert.deepEqual(await sdk.applicationAuth.requireLogin(), state.user);
  let calls = 0; const remove = sdk.applicationAuth.subscribe(() => calls++);
  for (const listener of profileListeners) listener(state.user);
  assert.equal(calls, 1); remove(); assert.equal(profileListeners.size, 0);
});

test("collection binds app and scope and preserves explicit idempotency and version", async () => {
  const requests = [];
  state.accountFetch = async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return Response.json({ result: { id: "record" } }); };
  const cloud = sdk.applicationCloud("app-a");
  await cloud.private.collection("moods").create({ text: "生花" });
  await cloud.public.collection("posts").update("record", { body: "hello" }, { requestId: "retry-once", expectedVersion: 2 });
  assert.equal(requests[0].url, "https://test/v1/app-data/app-a/private/moods");
  assert.match(requests[0].body.requestId, /^[A-Za-z0-9_-]{8,100}$/);
  assert.equal(requests[0].body.userId, undefined);
  assert.equal(requests[1].url, "https://test/v1/app-data/app-a/public/posts");
  assert.equal(requests[1].body.expectedVersion, 2); assert.equal(requests[1].body.requestId, "retry-once");
  assert.equal(identityListeners.size, 0);
  await assert.rejects(cloud.private.collection("moods").create({ invalid: undefined }), error => error.code === "INVALID_ARGUMENT");
});

test("account changes abort requests and reject old results", async () => {
  let started; const waiting = new Promise(resolve => { started = resolve; });
  state.accountFetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(new Error("aborted"))); started();
  });
  const pending = sdk.applicationCloud("app-a").private.collection("moods").list();
  const rejected = assert.rejects(pending, error => error.code === "ACCOUNT_CHANGED");
  await waiting; state.user = { id: "bob", name: "Bob", avatarUrl: null };
  for (const listener of identityListeners) listener("bob");
  await rejected; assert.equal(identityListeners.size, 0);
});

test("cancellation and server errors keep stable error codes", async () => {
  const collection = sdk.applicationCloud("app-a").private.collection("moods");
  const controller = new AbortController(); controller.abort();
  await assert.rejects(collection.list({}, { signal: controller.signal }), error => error.code === "CANCELLED");
  state.accountFetch = async () => Response.json({ code: "CONFLICT", message: "changed" }, { status: 409 });
  await assert.rejects(collection.get("record"), error => error.code === "CONFLICT");
  state.accountFetch = async () => Response.json({}, { status: 401 });
  await assert.rejects(collection.get("record"), error => error.code === "UNAUTHENTICATED");
});
