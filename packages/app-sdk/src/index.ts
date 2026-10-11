import type { ComponentType } from "react";
import type { AiService } from "./ai-types";
import type { AppAuth, AppCloud } from "./cloud-types";
import type { ApplicationNativeCapabilities, NativeActionResult, NativeErrorCode, OcrResult } from "./native-types";
export type { ApplicationNativeCapabilities, NativeActionResult, NativeErrorCode, SpeechOptions, RecognitionOptions, SensorKind, SensorSample, CalendarEventInput, ShortcutInput, WidgetInput, OcrResult, NativeRequestOptions, NativeValueResult, DeviceInfo, BluetoothDevice, NfcTag, HealthKind, HealthSummary, CalendarEvent } from "./native-types";
export { CloudError } from "./cloud-types";
export type { AppUser, AppAuth, AppCloud, CloudDatabase, CloudCollection, CloudRecord, CloudPage, CloudQuery, CloudRequestOptions, CloudWriteOptions, CloudErrorCode, CloudFile, CloudFiles, CloudRoom, CloudRooms, CloudRoomStatus, CloudRoomEvent, CloudRoomMember } from "./cloud-types";
export type {
  AiProvider,
  AiMessage,
  AiAttachment,
  AiCompletionRequest,
  AiErrorCode,
  AiCompletionResult,
  AiService,
  AiRequestOptions,
  AiStreamOptions,
} from "./ai-types";

export type AppAvatarProps = {
  size: number;
  animated?: boolean;
  borderRadius?: number;
};
export type ShareValue = null | boolean | number | string | ShareValue[] | { [key: string]: ShareValue };
export type ShareParams = { [key: string]: ShareValue };
export type ApplicationShareInput = { title?: string; description?: string; params?: ShareParams };
export type UserPostDraft = {
  application?: { appId: string; params?: ShareParams };
  body?: string;
  html?: string;
  requestId?: string;
};
export type ShellResult = { ok: boolean; error?: string };
export type NotificationOptions = {
  params?: ShareParams;
  /** Up to three buttons. Native snooze/complete work without starting RN. */
  actions?: { id: string; title: string; behavior?: "open" | "snooze" | "complete"; snoozeMs?: number }[];
};
export type ReminderOptions = NotificationOptions & {
  /** Local calendar time; weekdays: Monday=1, Sunday=7. Omitted timeZone follows the device. */
  repeat?: { hour: number; minute: number; weekdays: number[]; timeZone?: string };
};
export type NotificationEvent = { token: string; id: string; action: string; params: ShareParams; atMs: number };
export type ReminderResult = ShellResult & { atMs?: number; exact?: boolean };
export type NotificationStatus = ShellResult & {
  /** Host-wide notification permission. */
  granted?: boolean;
  /** Whether this application's channel is allowed. */
  channelEnabled?: boolean;
  /** Both host permission and this application's channel are allowed. */
  enabled?: boolean;
  channelId?: string;
  exact?: boolean;
};
export type LocationResult =
  | { ok: true; latitude: number; longitude: number; accuracy: number }
  | { ok: false; code: NativeErrorCode; error: string };
export type DataScope = "device" | "account";
export type FileActionResult = { ok: true } | { ok: false; code: NativeErrorCode | "ERROR"; error: string };
export type FileImportResult = { ok: true; path: string; name: string } | Extract<FileActionResult, { ok: false }>;
export type TextReadOptions = { signal?: AbortSignal };
export type TextChunkOptions = TextReadOptions & {
  /** UTF-8 bytes per chunk: 4–256 KiB, default 64 KiB. Characters stay intact. */
  chunkBytes?: number;
};
export type AppData = {
  storage: {
    get: (key: string) => string | undefined;
    set: (key: string, value: string) => void;
    remove: (key: string) => void;
    subscribe: (key: string, listener: (value: string | undefined) => void) => () => void;
  };
  secureStorage: {
    get: (key: string) => Promise<string | undefined>;
    set: (key: string, value: string) => Promise<void>;
    remove: (key: string) => Promise<void>;
  };
  files: {
    /** Offline Chinese/Latin OCR. Bounds refer to the returned, possibly downsampled/rotated image size. */
    recognizeText: (path: string, options?: { signal?: AbortSignal }) => Promise<OcrResult>;
    /** Opens system printing with an existing PDF; success does not mean printing completed. */
    print: (path: string, options?: { title?: string }) => Promise<NativeActionResult & { opened?: boolean }>;
    uri: (path: string) => string;
    /** Reads UTF-8 text up to 6 MiB. Use readTextChunks for large files. */
    readText: (path: string, options?: TextReadOptions) => Promise<string>;
    /** Pull-based UTF-8 chunks; break/return stops further reads. */
    readTextChunks: (path: string, options?: TextChunkOptions) => AsyncIterable<string>;
    /** Reads up to 6 MiB of an application file, for image/audio AI attachments. */
    readBase64: (path: string) => Promise<string>;
    writeText: (path: string, text: string) => Promise<void>;
    /** Writes raw base64 (no data URL prefix), up to 6 MiB decoded, without overwriting on failure. */
    writeBase64: (path: string, data: string) => Promise<void>;
    remove: (path: string) => Promise<void>;
    /** Lists direct children of the given relative directory. */
    list: (directory?: string) => Promise<string[]>;
    download: (url: string, path: string, options?: { signal?: AbortSignal; timeoutMs?: number; onProgress?: (received: number, total?: number) => void }) => Promise<void>;
    /** Copies a user-selected document into the application; cancellation is a normal result. */
    importFile: (path: string, options?: { mime?: string; signal?: AbortSignal; timeoutMs?: number; maxBytes?: number }) => Promise<FileImportResult>;
    /** Opens the system Save As dialog for an existing application file. */
    exportFile: (path: string, options?: { name?: string; mime?: string; signal?: AbortSignal; timeoutMs?: number; maxBytes?: number }) => Promise<FileActionResult>;
    /** Opens the system share sheet with an existing application file. */
    share: (path: string, options?: { title?: string; mime?: string }) => Promise<FileActionResult>;
    /** Saves existing app media to the gallery (Android 10+); older Android opens Save As without storage permission. */
    saveToGallery: (path: string, options?: { name?: string; mime?: string }) => Promise<FileActionResult>;
  };
};
export type ApplicationManifest = {
  format: number;
  appId: string;
  releaseId: string;
  version: string;
  appName: string;
  description: string;
  /** Changes in this version, shown in work details. */
  releaseNotes: string;
  accent: string;
  /** Independently cached icon resource, generated from assets/icon.svg. */
  icon?: { sha256: string; bytes: number; format: "svg" };
  dataSchemaVersion: number;
  /** Actual SDK package version used to build this application. */
  sdk: string;
  modules: { base: number; size: number };
  bundle: { sha256: string; bytes: number };
  assets: Array<{ name: string; sha256: string; bytes: number }>;
  source: { repository?: string; commit: string; tree?: string; applicationTree?: string; dirty: boolean };
};

export type AppDefinition = {
  main: () => ComponentType<Record<string, never>>;
  avatar?: ComponentType<AppAvatarProps>;
  onInstall?: (context: AppContext) => void | Promise<void>;
  /** Optional cleanup before this application's code is unloaded or replaced. */
  onDispose?: (context: AppContext) => void | Promise<void>;
};
export type AppContext = AppData & {
  appId: string;
  instanceId: string;
  auth: AppAuth;
  cloud: AppCloud;
  /** Device data is shared across host accounts; account data follows the signed-in account (or guest). */
  scope: (scope: DataScope) => AppData;
  /** Opens the host application-sharing sheet. User chooses and confirms the destination. */
  sharing: {
    open: (input?: ApplicationShareInput) => Promise<void>;
    getParams: () => ShareParams | undefined;
    subscribe: (listener: (params: ShareParams | undefined) => void) => () => void;
  };
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
  phone: ApplicationNativeCapabilities & {
    /** Request notification permission only from a user action. */
    requestNotifications: () => Promise<{ ok: boolean; granted?: boolean; status?: "unavailable" | "denied" | "blocked" | "granted" | "limited"; error?: string }>;
    notificationStatus: () => Promise<NotificationStatus>;
    /** Opens this app's channel settings, or host settings if permission is denied; only from a user action. */
    notificationSettings: (kind?: "notifications" | "exact") => Promise<ShellResult>;
    /** Persistent click events; acknowledge only after handling. Delivery can repeat until acknowledged. */
    onNotification: (listener: (event: NotificationEvent) => void) => () => void;
    acknowledgeNotification: (token: string) => Promise<ShellResult>;
    notify: (id: string, title: string, body: string, options?: NotificationOptions) => Promise<ShellResult>;
    schedule: (
      id: string,
      title: string,
      body: string,
      atMs: number,
      options?: ReminderOptions
    ) => Promise<ReminderResult>;
    /** Cancels a pending reminder and its displayed notification; IDs are local to this app. */
    cancelSchedule: (id: string) => Promise<ShellResult>;
    /** Cancels this application's pending and displayed notifications. */
    cancelAllSchedules: () => Promise<ShellResult>;
    schedules: () => Promise<{ ok: true; items: { id: string; title: string; body: string; atMs: number; options?: ReminderOptions }[] } | { ok: false; error: string }>;
  };
};

/** The application resolver supplies a bound SDK; the host never uses this placeholder. */
export function getAppContext(): AppContext {
  throw new Error("应用 SDK 尚未绑定应用实例");
}
export function defineApp(definition: AppDefinition): AppDefinition {
  return definition;
}
