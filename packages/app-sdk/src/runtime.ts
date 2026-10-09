import { applicationSharing, clearApplicationShareListeners } from "./sharing";
const bootstrap = require("../../../tools/applications/bootstrap.json");
import type { AppContext, AppDefinition, AppData, DataScope } from "./index";
import { createElement, useEffect, useContext, useSyncExternalStore } from "react";
import { requestNotifications, RESULTS } from "react-native-permissions";
import { writePackageValue } from "../../ui/packageLink";
import { applicationCapabilities } from "./capabilities";
import { applicationData } from "./data";
import { shell } from "../../platform/src/phone";
import { registerFeature } from "../../features/src/featureHost";
import { phone } from "../../platform/src/phone";
import { applicationAi } from "./ai";
import { KeyboardViewport } from "../../ui/keyboard";
import { ApplicationQueries, changeQueryAccount, clearApplicationQueries } from "./query-runtime";
import { applicationAuth, applicationCloud } from "./cloud";
import { useIsFocused } from "@react-navigation/native";
import { ApplicationCloudActivity } from "./cloud-activity";
import { setApplicationCloudActive } from "./cloud";
import { CloudError } from "./cloud-types";

const definitions = new Map<string, AppDefinition>();
type PageRecord = { definition: AppDefinition; generation: number; Page?: ReturnType<AppDefinition["main"]> };
let pageGeneration = 0;
const pages = new Map<string, PageRecord>();
const pageListeners = new Map<string, Set<() => void>>();
const registeredPages = new Set<string>();
function emitPage(appId: string) { pageListeners.get(appId)?.forEach(listener => listener()); }
export function subscribeApplicationRuntime(appId: string, listener: () => void) {
  let listeners = pageListeners.get(appId);
  if (!listeners) { listeners = new Set(); pageListeners.set(appId, listeners); }
  listeners.add(listener);
  return () => { listeners!.delete(listener); if (!listeners!.size) pageListeners.delete(appId); };
}
export function applicationRuntimeSnapshot(appId: string) { return activated.has(appId) ? pages.get(appId) : undefined; }
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
    changeQueryAccount(next);
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
    auth: applicationAuth,
    cloud: applicationCloud(appId),
    ai: applicationAi(() => navigate({ action: "providers" })),
    ...applicationCapabilities(),
    ...scope(appId === bootstrap.defaultApplication ? "account" : "device"),
    scope,
    sharing: applicationSharing(appId),
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
      location: phone.location,
      speak: phone.speak,
      requestNotifications: async () => { const { status } = await requestNotifications(["alert", "sound", "badge"]); return { ok: true, granted: status === RESULTS.GRANTED, status }; },
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
    CloudError,
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
  pages.set(appId, { definition, generation: ++pageGeneration });
  if (registeredPages.has(appId)) return;
  registeredPages.add(appId);

  // Main stays lazy; importing a card never executes its page module.
  function ApplicationContent({ record }: { record: PageRecord }) {
    const active = useContext(ApplicationCloudActivity);
    const focused = useIsFocused();
    useEffect(() => {
      if (!active || !focused) return;
      setApplicationCloudActive(appId, true);
      return () => setApplicationCloudActive(appId, false);
    }, [active, focused]);
    useEffect(() => {
      pageReady(appId);
    }, []);
    pageAttempt(appId);
    record.Page ??= record.definition.main();
    if (!record.Page) throw new Error(`应用页面无效：${appId}`);
    return createElement(ApplicationQueries, { appId, children: createElement(KeyboardViewport, { reserveBottom: false, children: createElement(record.Page) }) });
  }
  function ApplicationPage() {
    const record = useSyncExternalStore(listener => subscribeApplicationRuntime(appId, listener), () => applicationRuntimeSnapshot(appId));
    return record ? createElement(ApplicationContent, { key: record.generation, record }) : null;
  }
  registerFeature(appId, ApplicationPage);
}

export async function disposeApplication(appId: string) {
  const definition = definitions.get(appId);
  activated.delete(appId);
  pages.delete(appId);
  emitPage(appId);
  // Give mounted pages a chance to run effect cleanup before onDispose.
  await new Promise<void>(resolve => {
    const timer = setTimeout(resolve, 100);
    requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timer); resolve(); }));
  });
  try { await definition?.onDispose?.(applicationContext(appId)); }
  finally { definitions.delete(appId); activated.delete(appId); assets.delete(appId); contexts.delete(appId); clearApplicationShareListeners(appId); clearApplicationQueries(appId); }
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
  emitPage(appId);
}
