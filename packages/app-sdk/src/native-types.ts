import type { ShellResult, ShareParams } from "./index";

export type NativeErrorCode = "CANCELLED" | "PERMISSION" | "UNSUPPORTED" | "BUSY" | "TIMEOUT" | "NO_MATCH" | "NETWORK" | "UNAVAILABLE";
export type NativeActionResult = { ok: true } | { ok: false; code: NativeErrorCode; error: string };
export type SpeechOptions = { language?: string; rate?: number; pitch?: number; signal?: AbortSignal };
export type RecognitionOptions = { language?: string; onDevice?: boolean; signal?: AbortSignal; onPartial?: (text: string) => void };
export type SensorKind = "accelerometer" | "gyroscope" | "gravity" | "rotation";
/** timestampMs is monotonic time since boot. Acceleration: m/s², gyroscope: rad/s, rotation: Android rotation vector. */
export type SensorSample = { sensor: SensorKind; values: number[]; timestampMs: number; accuracy: number };
/** All-day events use UTC midnight date boundaries; endMs is exclusive. */
export type CalendarEventInput = { title: string; startMs: number; endMs: number; description?: string; location?: string; allDay?: boolean };
export type ShortcutInput = { id: string; label?: string; params?: ShareParams; /** Existing raster image in device-scoped app files. */ iconPath?: string };
export type ApplicationNativeCapabilities = {
  /** Resolves when queued, retaining the original speak contract. */
  speak: (text: string) => Promise<NativeActionResult>;
  stopSpeaking: () => Promise<NativeActionResult>;
  speech: {
    /** Resolves on completion, cancellation or failure. Requests from other apps are never interrupted. */
    speak: (text: string, options?: SpeechOptions) => Promise<NativeActionResult>;
    status: () => Promise<ShellResult & { recognition?: boolean; onDevice?: boolean; microphone?: boolean; tts?: boolean }>;
    /** Only call in response to the user choosing voice input. */
    requestPermission: () => Promise<{ granted: boolean; status: string }>;
    recognize: (options?: RecognitionOptions) => Promise<({ ok: true; text: string } | Extract<NativeActionResult, { ok: false }>)>;
  };
  shortcuts: {
    status: () => Promise<ShellResult & { supported?: boolean }>;
    /** Requests launcher confirmation; requested does not mean the user accepted. Reusing an ID updates its pinned entry. */
    add: (input: ShortcutInput) => Promise<(NativeActionResult & { requested?: boolean; existing?: boolean })>;
    /** Disables the pinned entry; the launcher may retain its icon. */
    remove: (id: string) => Promise<NativeActionResult>;
  };
  calendar: {
    /** Opens the system editor; success does not mean the user saved the event. No calendar read/write permission. */
    compose: (input: CalendarEventInput) => Promise<NativeActionResult>;
  };
  sensors: {
    available: () => Promise<ShellResult & { items?: SensorKind[] }>;
    /** Suspended offscreen/background; resumes while subscribed. No dangerous permissions at 20–1000 ms sampling. */
    subscribe: (kind: SensorKind, listener: (sample: SensorSample) => void, options?: { intervalMs?: number; onError?: (error: Extract<NativeActionResult, { ok: false }>) => void }) => () => void;
  };
  biometrics: {
    /** Android 9: supported=true, available omitted, status=-1; attempt system verification. */
    status: () => Promise<ShellResult & { supported?: boolean; available?: boolean; status?: number }>;
    /** System verification, not file encryption. Android 11+ also allows device credentials. */
    authenticate: (options?: { title?: string; subtitle?: string; signal?: AbortSignal }) => Promise<NativeActionResult>;
  };
};
