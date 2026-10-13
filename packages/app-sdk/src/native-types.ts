import type { ShellResult, ShareParams, LocationResult } from "./index";

export type NativeErrorCode = "CANCELLED" | "PERMISSION" | "UNSUPPORTED" | "BUSY" | "TIMEOUT" | "NO_MATCH" | "NETWORK" | "UNAVAILABLE" | "DISABLED" | "TOO_LARGE" | "LANGUAGE_UNSUPPORTED" | "MISSING_DATA" | "READ_ONLY" | "TAG_LOST" | "CONNECTION_LOST" | "REJECTED" | "NOT_FOUND" | "ALREADY_EXISTS";
export type NativeActionResult = { ok: true } | { ok: false; code: NativeErrorCode; error: string };
export type SpeechState = "listening" | "hearing" | "processing" | "speaking";
export type SpeechVoice = { id: string; language: string; networkRequired: boolean; quality: number };
export type SpeechOptions = { language?: string; voice?: string; rate?: number; pitch?: number; signal?: AbortSignal; /** 1 second–30 minutes; default 10 minutes. */ timeoutMs?: number; onState?: (state: SpeechState) => void };
export type RecognitionOptions = { language?: string; /** Save the same microphone capture as WAV in device-scoped application files. Use a new relative path for each recording. */ recordingPath?: string; signal?: AbortSignal; onPartial?: (text: string) => void; onState?: (state: SpeechState) => void; /** Local PCM RMS in dBFS (-120..0), at most 10 Hz. */ onVolume?: (level: number) => void };
export type SensorKind = "accelerometer" | "gyroscope" | "gravity" | "rotation";
/** timestampMs is monotonic time since boot. Acceleration: m/s², gyroscope: rad/s, rotation: Android rotation vector. */
export type SensorSample = { sensor: SensorKind; values: number[]; timestampMs: number; accuracy: number };
/** All-day events use UTC midnight date boundaries; endMs is exclusive. */
export type CalendarEventInput = { title: string; startMs: number; endMs: number; description?: string; location?: string; allDay?: boolean };
export type ShortcutInput = { id: string; label?: string; params?: ShareParams; /** Existing raster image in device-scoped app files. */ iconPath?: string };
export type WidgetInput = { id: string; title: string; body?: string; imagePath?: string; params?: ShareParams; progress?: number; backgroundColor?: string; textColor?: string };
export type OcrResult = { ok: true; text: string; width: number; height: number; blocks: { text: string; lines: string[]; bounds?: { x: number; y: number; width: number; height: number } }[] } | Extract<NativeActionResult, { ok: false }>;
export type NativeRequestOptions = { signal?: AbortSignal; timeoutMs?: number };
export type NativeValueResult<T> = ({ ok: true } & T) | Extract<NativeActionResult, { ok: false }>;
export type DeviceInfo = { brand: string; model: string; sdk: number; release: string; battery: number; charging: boolean };
export type BluetoothDevice = { name: string; address: string; rssi?: number };
export type BluetoothService = { uuid: string; characteristics: { uuid: string; properties: number; descriptors: string[] }[] };
export type BluetoothEvent = { connectionId: string; type: "disconnected" } | { connectionId: string; type: "value"; service: string; characteristic: string; data: string };
export type BluetoothCharacteristic = { connectionId: string; service: string; characteristic: string };
export type NfcWriteRecord = { type: "text"; text: string; language?: string } | { type: "uri"; uri: string };
export type NfcTag = { id: string; text: string; records: { text: string; type: string }[]; technologies: string[] };
export type HealthKind = "steps" | "heartRate" | "sleep";
export type HealthSummary = { steps?: number; sleepMinutes?: number; heartRate?: number | null; heartRateAtMs?: number | null };
export type CalendarEvent = { id: string; title: string; startMs: number; endMs: number; allDay: boolean };
export type ApplicationNativeCapabilities = {
  /** One foreground fix; request location permission first. Accuracy is in metres. */
  location: (options?: NativeRequestOptions & { accuracy?: "fine" | "coarse" }) => Promise<LocationResult>;
  device: () => Promise<NativeValueResult<DeviceInfo>>;
  /** Opens an external URL from an explicit user action. */
  openUrl: (url: string) => Promise<NativeActionResult>;
  /** Camera permission required; released offscreen, in background, or on disposal. */
  torch: (on: boolean) => Promise<NativeActionResult>;
  bluetooth: {
    status: () => Promise<NativeValueResult<{ present: boolean; enabled: boolean }>>;
    requestPermissions: () => Promise<NativeValueResult<{ granted: boolean }>>;
    pairedDevices: () => Promise<NativeValueResult<{ items: BluetoothDevice[] }>>;
    /** BLE discovery only; does not connect or read GATT characteristics. */
    scan: (options?: NativeRequestOptions & { seconds?: number }) => Promise<NativeValueResult<{ items: BluetoothDevice[] }>>;
    /** Foreground BLE GATT; hides/background disconnect it. Two connections per app, four per host. */
    connect: (address: string, options?: NativeRequestOptions) => Promise<NativeValueResult<{ connectionId: string }>>;
    disconnect: (connectionId: string) => Promise<NativeActionResult>;
    services: (connectionId: string, options?: NativeRequestOptions) => Promise<NativeValueResult<{ items: BluetoothService[] }>>;
    read: (characteristic: BluetoothCharacteristic, options?: NativeRequestOptions) => Promise<NativeValueResult<{ data: string }>>;
    /** Raw base64, 1–512 bytes decoded; device/MTU can impose a smaller write limit. */
    write: (characteristic: BluetoothCharacteristic, data: string, options?: NativeRequestOptions & { withoutResponse?: boolean }) => Promise<NativeActionResult>;
    subscribe: (characteristic: BluetoothCharacteristic, options?: NativeRequestOptions) => Promise<NativeActionResult>;
    unsubscribe: (characteristic: BluetoothCharacteristic, options?: NativeRequestOptions) => Promise<NativeActionResult>;
    /** Subscribe before enabling characteristic notifications. Binary values are raw base64. */
    onEvent: (listener: (event: BluetoothEvent) => void) => () => void;
  };
  nfc: {
    status: () => Promise<NativeValueResult<{ present: boolean; enabled: boolean }>>;
    /** Reads one tag/NDEF message; does not write cards or emulate payment cards. */
    read: (options?: NativeRequestOptions) => Promise<NativeValueResult<NfcTag>>;
    /** Writes NDEF text/URI records to a writable tag. Cancellation cannot undo a completed write. */
    write: (records: NfcWriteRecord[], options?: NativeRequestOptions) => Promise<NativeValueResult<{ id: string }>>;
  };
  health: {
    status: () => Promise<NativeValueResult<{ status: "available" | "update" | "unavailable" }>>;
    permissions: () => Promise<NativeValueResult<{ granted: HealthKind[] }>>;
    requestPermissions: (options?: NativeRequestOptions & { kinds?: HealthKind[] }) => Promise<NativeValueResult<{ granted: HealthKind[]; grantedAll: boolean }>>;
    summary: (fromMs: number, toMs: number, options?: NativeRequestOptions & { kinds?: HealthKind[] }) => Promise<NativeValueResult<HealthSummary>>;
  };
  keepAwake: (on: boolean) => Promise<NativeActionResult>;
  /** Resolves when queued, retaining the original speak contract. */
  speak: (text: string) => Promise<NativeActionResult>;
  stopSpeaking: () => Promise<NativeActionResult>;
  speech: {
    /** Resolves on completion, cancellation or failure. Requests from other apps are never interrupted. */
    speak: (text: string, options?: SpeechOptions) => Promise<NativeActionResult>;
    status: () => Promise<ShellResult & { recognition?: boolean; onDevice?: boolean; modelReady?: boolean; microphone?: boolean; recording?: boolean; tts?: boolean }>;
    voices: (options?: NativeRequestOptions) => Promise<NativeValueResult<{ items: SpeechVoice[] }>>;
    /** Bundled local ASR languages; online is empty. */
    languages: (options?: NativeRequestOptions) => Promise<NativeValueResult<{ installed: string[]; supported: string[]; online: string[] }>>;
    /** Only call in response to the user choosing voice input. */
    requestPermission: () => Promise<{ granted: boolean; status: string }>;
    /** Prepares/downloads the shared local model from a user gesture without starting the microphone. */
    prepare: (options?: { signal?: AbortSignal }) => Promise<NativeActionResult>;
    recognize: (options?: RecognitionOptions) => Promise<({ ok: true; text: string; recording?: { path: string; durationMs: number; mime: "audio/wav" } } | Extract<NativeActionResult, { ok: false }>)>;
    /** Stops listening and waits for the existing recognize() request to produce its final result. */
    finish: () => Promise<NativeActionResult>;
    cancel: () => Promise<NativeActionResult>;
  };
  shortcuts: {
    list: () => Promise<ShellResult & { items?: { id: string; label: string; enabled: boolean }[] }>;
    status: () => Promise<ShellResult & { supported?: boolean }>;
    /** Requests launcher confirmation; requested does not mean the user accepted. Reusing an ID updates its pinned entry. */
    add: (input: ShortcutInput) => Promise<(NativeActionResult & { requested?: boolean; existing?: boolean })>;
    /** Disables the pinned entry; the launcher may retain its icon. */
    remove: (id: string) => Promise<NativeActionResult>;
  };
  widgets: {
    status: () => Promise<ShellResult & { supported?: boolean }>;
    /** Saves a persistent snapshot and updates all pinned instances of this ID. */
    set: (input: WidgetInput) => Promise<NativeActionResult>;
    /** Launcher confirmation is required; requested is not confirmation of installation. Call set first. */
    pin: (id: string) => Promise<NativeActionResult & { requested?: boolean }>;
    list: () => Promise<ShellResult & { items?: { id: string; instances: number[] }[] }>;
    /** Clears content and disables entry; only the user can remove the launcher widget. */
    remove: (id: string) => Promise<NativeActionResult>;
  };
  calendar: {
    /** Expanded instances, including recurring/overlapping events; needs READ_CALENDAR. */
    events: (fromMs: number, toMs: number, options?: NativeRequestOptions & { limit?: number; offset?: number }) => Promise<NativeValueResult<{ items: CalendarEvent[]; nextOffset: number | null }>>;
    /** Insert needs READ_CALENDAR + WRITE_CALENDAR; direct mutations require an explicit user action. */
    insert: (input: CalendarEventInput, options?: NativeRequestOptions) => Promise<NativeValueResult<{ id: string }>>;
    remove: (id: string, options?: NativeRequestOptions) => Promise<NativeValueResult<{ removed: boolean }>>;
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
