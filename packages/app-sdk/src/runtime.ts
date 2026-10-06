const bootstrap = require("../../../tools/applications/bootstrap.json");
import type { AppContext, AppDefinition, AppData, DataScope } from "./index";
import { createElement, useEffect } from "react";
import { writePackageValue } from "../../ui/packageLink";
import { applicationCapabilities } from "./capabilities";
import { applicationData, fileAction } from "./data";
import { shell } from "../../platform/src/phone";
import { registerFeature } from "../../features/src/featureHost";
import { phone } from "../../platform/src/phone";
import { applicationAi } from "./ai";
import { KeyboardViewport } from "../../ui/keyboard";

const definitions = new Map<string, AppDefinition>();
const activated = new Set<string>();
const contexts = new Map<string, AppContext>();
const assets = new Map<string, Record<string, string>>();
let accountScope = "guest";
const scopeListeners = new Set<() => void>();
let pageReady: (appId: string) => void = () => {};
let pageAttempt: (appId: string) => void = () => {};
let postShare: (
  appId: string,
  draft: import("./index").UserPostDraft
) => Promise<{ id: string }> = async () => {
  throw new Error("宿主分享入口尚未就绪");
};
let postCompose: (
  appId: string,
  draft: import("./index").UserPostDraft
) => Promise<void> = async () => {
  throw new Error("宿主分享入口尚未就绪");
};
export function setApplicationPostHandlers(
  share: typeof postShare,
  compose: typeof postCompose
) {
  postShare = share;
  postCompose = compose;
}
let creationNavigation: (appId: string, prompt?: string) => void = () => {};
export function setApplicationCreationNavigation(
  handler: typeof creationNavigation
) {
  creationNavigation = handler;
}
export function setApplicationAccountScope(id: string | null) {
  const next = id ?? "guest";
  if (!/^[a-zA-Z0-9-]{1,100}$/.test(next)) throw new Error("账号作用域无效");
  if (next !== accountScope) {
    accountScope = next;
    scopeListeners.forEach((listener) => listener());
  }
}
export function onApplicationPageReady(handler: (appId: string) => void) {
  pageReady = handler;
}
export function onApplicationPageAttempt(handler: (appId: string) => void) {
  pageAttempt = handler;
}
export function installApplicationAssets(
  appId: string,
  files: Record<string, string>
) {
  assets.set(appId, files);
}
export function applicationContext(appId: string): AppContext {
  const existing = contexts.get(appId);
  if (existing) return existing;
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new Error("应用身份无效");
  const data = new Map<DataScope, AppData>();
  const scope = (value: DataScope) => {
    if (value !== "device" && value !== "account") throw new Error("数据作用域无效");
    let bound = data.get(value);
    if (!bound) {
      bound = applicationData(appId, value, () => accountScope, listener => { scopeListeners.add(listener); return () => { scopeListeners.delete(listener); }; });
      if (appId === bootstrap.defaultApplication && value === "account") {
        const get = bound.storage.get;
        bound.storage.get = key => key === "__accountScope" ? accountScope : get(key);
      }
      data.set(value, bound);
    }
    return bound;
  };
  const reminderId = (id: string) => {
    if (!/^[A-Za-z0-9._-]+$/.test(id) || `${appId}:${id}`.length > 80) throw new Error("提醒 ID 无效或过长");
    return `${appId}:${id}`;
  };
  const navigate = (request: object) =>
    writePackageValue(
      "shell.nav.request",
      JSON.stringify({ ...request, at: Date.now() })
    );
  const context: AppContext = {
    appId,
    instanceId: appId,
    ai: applicationAi(() => navigate({ action: "providers" })),
    ...applicationCapabilities(),
    ...scope(appId === bootstrap.defaultApplication ? "account" : "device"),
    scope,
    share: input => fileAction("share", { text: input.text, title: input.title }),
    assets: {
      uri: (name) => {
        const uri = assets.get(appId)?.[name];
        if (!uri) throw new Error(`应用资源未安装：${appId}/${name}`);
        return uri;
      },
    },
    feed: {
      share: (draft) => postShare(appId, draft),
      compose: (draft) => postCompose(appId, draft),
    },
    navigation: {
      back: () => navigate({ action: "back" }),
      open: () => navigate({ action: "open", id: appId }),
      create: (prompt) => creationNavigation(appId, prompt),
    },
    phone: {
      vibrate: phone.vibrate,
      speak: phone.speak,
      requestNotifications: () => shell("requestPermission", { name: "notifications" }),
      notify: (id, title, body) => phone.notify(reminderId(id), title, body),
      schedule: (id, title, body, atMs) =>
        phone.schedule(reminderId(id), title, body, atMs),
      cancelSchedule: id => shell("cancelSchedule", { id: reminderId(id) }),
      schedules: async () => {
        try {
          const result = await shell<{ ok: boolean; items?: { id: string; title: string; body: string; atMs: number }[] }>("schedules", {});
          if (!result.ok || !Array.isArray(result.items)) return { ok: false, error: "无法查询提醒" };
          const prefix = `${appId}:`;
          return { ok: true, items: result.items.filter(item => item.id.startsWith(prefix)).map(item => ({ ...item, id: item.id.slice(prefix.length) })) };
        } catch { return { ok: false, error: "无法查询提醒" }; }
      },
      keepAwake: phone.keepAwake,
    },
  };
  contexts.set(appId, context);
  return context;
}

export function bindApplicationSdk(appId: string) {
  return {
    defineApp: (definition: AppDefinition) => definition,
    getAppContext: () => applicationContext(appId),
  };
}

export function registerApplication(appId: string, definition: AppDefinition) {
  if (definitions.has(appId))
    throw new Error(`应用已经加载，更新需要重载：${appId}`);
  if (!definition || typeof definition.main !== "function")
    throw new Error(`应用入口无效：${appId}`);
  definitions.set(appId, definition);

  // Main stays lazy; importing a card never executes its page module.
  let Page: ReturnType<AppDefinition["main"]> | undefined;
  function ApplicationPage() {
    useEffect(() => {
      pageReady(appId);
    }, []);
    pageAttempt(appId);
    Page ??= definition.main();
    if (!Page) throw new Error(`应用页面无效：${appId}`);
    return createElement(KeyboardViewport, { reserveBottom: false, children: createElement(Page) });
  }
  registerFeature(appId, ApplicationPage);
}

export function peekRegisteredApplication(appId: string) {
  return definitions.get(appId);
}
export function peekApplication(appId: string) {
  return activated.has(appId) ? definitions.get(appId) : undefined;
}
export function activateApplication(appId: string) {
  const definition = definitions.get(appId);
  if (!definition || activated.has(appId)) return;
  activated.add(appId);
}
