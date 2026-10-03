import type { ComponentType } from "react";
import type { AiService } from "./ai-types";
export type {
  AiProvider,
  AiMessage,
  AiCompletionRequest,
  AiErrorCode,
  AiCompletionResult,
  AiService,
} from "./ai-types";

export type AppAvatarProps = {
  size: number;
  animated?: boolean;
  borderRadius?: number;
};
export type UserPostDraft = {
  body?: string;
  html?: string;
  requestId?: string;
};
export type ShellResult = { ok: boolean; error?: string };
export type ApplicationManifest = {
  format: number;
  appId: string;
  releaseId: string;
  version: string;
  title: string;
  summary: string;
  mark: string;
  accent: string;
  dataSchemaVersion: number;
  requires: { engineAbi: string; sdk: string; shared: Record<string, string> };
  modules: { base: number; size: number };
  bundle: { sha256: string; bytes: number };
  assets: Array<{ name: string; sha256: string; bytes: number }>;
  source: { repository?: string; commit: string; dirty: boolean };
};

export type AppDefinition = {
  main: () => ComponentType<Record<string, never>>;
  avatar?: ComponentType<AppAvatarProps>;
  onInstall?: (context: AppContext) => void | Promise<void>;
};
export type AppContext = {
  appId: string;
  instanceId: string;
  ai: AiService;
  assets: { uri: (name: string) => string };
  clipboard: { get: () => Promise<string>; set: (text: string) => void };
  haptics: {
    trigger: (
      kind:
        | "selection"
        | "impactLight"
        | "impactMedium"
        | "impactHeavy"
        | "notificationSuccess"
        | "notificationWarning"
        | "notificationError"
    ) => void;
  };
  toast: { show: (text: string, kind?: "success" | "error" | "info") => void };
  secureStorage: {
    get: (key: string) => Promise<string | undefined>;
    set: (key: string, value: string) => Promise<void>;
    remove: (key: string) => Promise<void>;
  };
  files: {
    uri: (path: string) => string;
    readText: (path: string) => Promise<string>;
    writeText: (path: string, text: string) => Promise<void>;
    remove: (path: string) => Promise<void>;
    list: () => Promise<string[]>;
    download: (url: string, path: string) => Promise<void>;
  };
  storage: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
    subscribe: (
      key: string,
      listener: (value: string | undefined) => void
    ) => () => void;
  };
  feed: {
    /** Publishes as the signed-in user immediately; call only from an explicit user action. */
    share: (draft: UserPostDraft) => Promise<{ id: string }>;
    /** Opens the editable host composer instead of publishing. */
    compose: (draft: UserPostDraft) => Promise<void>;
  };
  navigation: {
    back: () => void;
    open: () => void;
    create: (prompt?: string) => void;
  };
  phone: {
    vibrate: (ms?: number) => Promise<ShellResult>;
    speak: (text: string) => Promise<ShellResult>;
    notify: (id: string, title: string, body: string) => Promise<ShellResult>;
    schedule: (
      id: string,
      title: string,
      body: string,
      atMs: number
    ) => Promise<ShellResult>;
    keepAwake: (on: boolean) => Promise<ShellResult>;
  };
};

/** The application resolver supplies a bound SDK; the host never uses this placeholder. */
export function getAppContext(): AppContext {
  throw new Error("应用 SDK 尚未绑定应用实例");
}
export function defineApp(definition: AppDefinition): AppDefinition {
  return definition;
}
