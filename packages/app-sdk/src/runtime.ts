const bootstrap = require("../../../tools/applications/bootstrap.json");
import type { AppContext, AppDefinition } from "./index";
import { createElement } from "react";
import { readPackageValue, subscribePackageValue, writePackageValue } from "../../ui/packageLink";
import { publishFeedPost, recordFeedChange, registerFeedTemplates, upsertFeedPost, removeFeedPost } from "../../ui/feed/store";
import { registerFeature } from "../../features/src/featureHost";
import { phone } from "../../platform/src/phone";

const definitions = new Map<string, AppDefinition>();
const contexts = new Map<string, AppContext>();
const assets = new Map<string, Record<string, string>>();
export function installApplicationAssets(appId: string, files: Record<string, string>) { assets.set(appId, files); }
const legacyKeys: Record<string, Record<string, string>> = {
  notepad: { notes: "notepad.notes" },
  pomodoro: { stats: "pomodoro.stats.v1" },
  jolly: { run: "jolly.run.v1" },
};

export function applicationContext(appId: string): AppContext {
  const existing = contexts.get(appId);
  if (existing) return existing;
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("应用身份无效");
  const keyFor = (key: string) => {
    if (!key || key.length > 200) throw new Error("应用存储键无效");
    return `application.${appId}.${key}`;
  };
  const navigate = (request: object) => writePackageValue("shell.nav.request", JSON.stringify({ ...request, at: Date.now() }));
  const context: AppContext = {
    appId, instanceId: appId,
    assets: { uri: (name) => {
      const uri = assets.get(appId)?.[name];
      if (!uri) throw new Error(`应用资源未安装：${appId}/${name}`);
      return uri;
    } },
    storage: {
      get: (key) => {
        const target = keyFor(key);
        const stored = readPackageValue(target);
        if (stored !== undefined) return stored;
        const legacy = legacyKeys[appId]?.[key];
        const value = legacy ? readPackageValue(legacy) : undefined;
        if (value !== undefined) writePackageValue(target, value);
        return value;
      },
      set: (key, value) => writePackageValue(keyFor(key), value),
      subscribe: (key, listener) => subscribePackageValue(keyFor(key), listener),
    },
    feed: {
      publish: (post) => publishFeedPost({ ...post, appId }),
      recordChange: (note) => recordFeedChange({ appId, note }),
      upsert: (post) => {
        if (!post.id.startsWith(`${appId}-`)) throw new Error("动态身份不属于当前应用");
        upsertFeedPost({ ...post, appId });
      },
      remove: (id) => {
        if (!id.startsWith(`${appId}-`)) throw new Error("动态身份不属于当前应用");
        removeFeedPost(id);
      },
    },
    navigation: {
      back: () => navigate({ action: "back" }),
      open: () => navigate({ action: "open", id: appId }),
      create: (prompt) => {
        if (prompt) applicationContext(bootstrap.defaultApplication).storage.set("pendingPrompt", prompt);
        navigate({ action: "tab", tab: "agent" });
      },
    },
    phone: { vibrate: phone.vibrate, speak: phone.speak, notify: (id, title, body) => phone.notify(`${appId}:${id}`, title, body), schedule: (id, title, body, atMs) => phone.schedule(`${appId}:${id}`, title, body, atMs), keepAwake: phone.keepAwake },
  };
  contexts.set(appId, context);
  return context;
}

export function bindApplicationSdk(appId: string) {
  return { defineApp: (definition: AppDefinition) => definition, getAppContext: () => applicationContext(appId) };
}

export function registerApplication(appId: string, definition: AppDefinition) {
  if (definitions.has(appId)) throw new Error(`应用已经加载，更新需要重载：${appId}`);
  if (!definition || typeof definition.main !== "function") throw new Error(`应用入口无效：${appId}`);
  definitions.set(appId, definition);
  if (definition.cards) registerFeedTemplates(appId, definition.cards);
  // Main stays lazy; importing a card never executes its page module.
  let Page: ReturnType<AppDefinition["main"]> | undefined;
  function ApplicationPage() {
    Page ??= definition.main();
    if (!Page) throw new Error(`应用页面无效：${appId}`);
    return createElement(Page);
  }
  registerFeature(appId, ApplicationPage);
}

export function peekApplication(appId: string) { return definitions.get(appId); }
