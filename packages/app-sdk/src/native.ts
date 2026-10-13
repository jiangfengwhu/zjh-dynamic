import { AppState, DeviceEventEmitter, Platform } from "react-native";
import { PERMISSIONS, request, requestMultiple } from "react-native-permissions";
import { shell } from "../../platform/src/phone";
import { prepareSpeechModel } from "../../platform/src/speechModel";
import { normalizeShareParams } from "./sharing";
import { nativeResult, nativeMessages as messages } from "./native-result";
import type { ApplicationNativeCapabilities, NativeActionResult, NativeErrorCode, SensorKind, SensorSample, NativeValueResult, DeviceInfo, BluetoothDevice, NfcTag, HealthKind, HealthSummary, CalendarEvent } from "./native-types";

const bindings = new Map<string, { active: () => boolean; visibility: (delta: number) => void; clear: () => void }>();
let sequence = 0;
const cancelled: Extract<NativeActionResult, { ok: false }> = { ok: false, code: "CANCELLED", error: "已取消" };
async function action(method: string, payload: Record<string, unknown>): Promise<NativeActionResult & Record<string, unknown>> {
  try {
    const value = await shell<{ ok: boolean; error?: string } & Record<string, unknown>>(method, payload);
    return nativeResult(value);
  } catch { return { ok: false as const, code: "UNAVAILABLE" as const, error: messages.UNAVAILABLE }; }
}
export function setApplicationNativeActive(appId: string, active: boolean) { bindings.get(appId)?.visibility(active ? 1 : -1); }
export function isApplicationNativeActive(appId: string) { return bindings.get(appId)?.active() === true; }
export function clearApplicationNative(appId: string) { bindings.get(appId)?.clear(); bindings.delete(appId); void shell("documentStopApp", { appId }).catch(() => {}); void shell("operationStopApp", { appId }).catch(() => {}); }

export function applicationNative(appId: string, metadata: () => { title: string; accent: string }, fileUri: (path: string) => string): ApplicationNativeCapabilities {
  let visible = 0, disposed = false, foreground = AppState.currentState === "active";
  let wantsAwake = false;
  let sensorChain: Promise<unknown> = Promise.resolve();
  type SensorSubscription = { kind: SensorKind; listener: (sample: SensorSample) => void; intervalMs: number; onError?: (error: Extract<NativeActionResult, { ok: false }>) => void };
  const sensors = new Map<string, SensorSubscription>();
  const cancellations = new Map<() => void, boolean>();
  const speechPreparations = new Set<AbortController>();
  const bluetoothListeners = new Set<(event: import("./native-types").BluetoothEvent) => void>();
  const bluetoothEvents = DeviceEventEmitter.addListener("zijinhua.bluetooth", raw => {
    try {
      const event = JSON.parse(raw.payload);
      if (disposed || event.appId !== appId || event.type === "value" && !available()) return;
      for (const listener of [...bluetoothListeners]) { try { listener(event); } catch {} }
    } catch {}
  });
  const newId = () => `native-${Date.now()}-${++sequence}`;
  const available = () => !disposed && foreground && visible > 0;
  const startSensor = (requestId: string, item: SensorSubscription) => {
    sensorChain = sensorChain.then(async () => {
      if (!available() || sensors.get(requestId) !== item) return;
      const result = await action("sensorStart", { appId, requestId, kind: item.kind, intervalMs: item.intervalMs });
      if (!result.ok && sensors.get(requestId) === item && available()) { sensors.delete(requestId); try { item.onError?.(result); } catch {} }
    });
  };
  const suspend = (background = false) => {
    cancellations.forEach((biometric, cancel) => { if (!background || !biometric) cancel(); });
    // Dispatch before a replacement app can start; queued sensor starts recheck visibility.
    void action("appNativeStop", { appId, includeBiometric: !background });
    void action("operationSuspendApp", { appId });
  };
  const resume = () => { if (available()) { sensors.forEach((item, id) => startSensor(id, item)); if (wantsAwake) void action("appKeepAwake", { appId, on: true }); } };
  const stateListener = AppState.addEventListener("change", state => {
    const next = state === "active";
    if (foreground === next) return;
    foreground = next;
    if (next) resume(); else suspend(true);
  });
  const events = DeviceEventEmitter.addListener("zijinhua.app.native", (event: SensorSample & { appId: string; requestId: string; kind: string }) => {
    if (!available() || event.appId !== appId || event.kind !== "sensor") return;
    const item = sensors.get(event.requestId);
    if (!item || item.kind !== event.sensor) return;
    try { item.listener({ sensor: event.sensor, values: event.values, timestampMs: event.timestampMs, accuracy: event.accuracy }); } catch {}
  });
  bindings.set(appId, {
    active: available,
    visibility: delta => { const was = available(); visible = Math.max(0, visible + delta); void action("appNativeVisibility", { appId, active: visible > 0 }); if (was && !available()) suspend(); else if (!was && available()) resume(); },
    clear: () => { disposed = true; wantsAwake = false; void action("appNativeVisibility", { appId, active: false }); suspend(); sensors.clear(); bluetoothListeners.clear(); bluetoothEvents.remove(); events.remove(); stateListener.remove(); },
  });
  async function operation(method: string, stop: string, options: { signal?: AbortSignal; onPartial?: (text: string) => void; onState?: (state: import("./native-types").SpeechState) => void; onVolume?: (level: number) => void } & Record<string, unknown>, requireVisible = true) {
    if (disposed || requireVisible && !available() || options.signal?.aborted) return cancelled;
    if (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || (options.timeoutMs as number) < 1000 || (options.timeoutMs as number) > (method === "speechSpeak" ? 1800000 : 180000))) throw new Error(method === "speechSpeak" ? "朗读超时须为 1 秒–30 分钟" : "超时须为 1–180 秒");
    const requestId = newId();
    let aborted = false;
    let resolveAbort: (value: NativeActionResult) => void = () => {};
    const cancellation = new Promise<NativeActionResult>(resolve => { resolveAbort = resolve; });
    const abort = () => {
      if (aborted) return;
      aborted = true; resolveAbort(cancelled);
      // Interactive native calls are dispatched directly to the main looper in call order.
      void action(stop, { appId, requestId });
    };
    const event = options.onPartial || options.onState || options.onVolume ? DeviceEventEmitter.addListener("zijinhua.app.native", value => {
      if (aborted || !available() || value.appId !== appId || value.requestId !== requestId) return;
      try {
        if (value.kind === "speech") options.onPartial?.(value.text);
        if (value.kind === "speech-state") options.onState?.(value.state);
        if (value.kind === "speech-volume") options.onVolume?.(value.level);
      } catch { abort(); }
    }) : undefined;
    const { signal, onPartial, onState, onVolume, ...input } = options;
    const native = action(method, { ...input, appId, requestId });
    cancellations.set(abort, method === "biometricAuthenticate" || method === "requestHealth"); signal?.addEventListener("abort", abort);
    if (signal?.aborted) abort();
    try { return await Promise.race([native, cancellation]); }
    finally { cancellations.delete(abort); event?.remove(); signal?.removeEventListener("abort", abort); }
  }
  const query = <T,>(method: string, input: Record<string, unknown> = {}) => operation(method, "operationCancel", input,
    ["location", "openUrl", "requestHealth", "bluetoothScan", "bluetoothConnect", "bluetoothServices", "bluetoothRead", "bluetoothWrite", "bluetoothSubscribe", "nfcRead", "nfcWrite", "calendarInsert", "calendarRemove"].includes(method) || method === "torch" && input.on === true) as Promise<NativeValueResult<T>>;
  const connection = (id: string) => { if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("蓝牙连接标识无效"); return id; };
  const characteristic = (value: import("./native-types").BluetoothCharacteristic) => {
    connection(value.connectionId);
    for (const id of [value.service, value.characteristic]) if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new Error("蓝牙服务和特征须使用完整 UUID");
    return value;
  };
  const range = (fromMs: number, toMs: number) => {
    if (!Number.isSafeInteger(fromMs) || !Number.isSafeInteger(toMs) || fromMs < 0 || toMs <= fromMs || toMs - fromMs > 366 * 86400000) throw new Error("查询时间范围须在 366 天以内");
  };
  const healthKinds = (kinds?: HealthKind[]) => { if (kinds !== undefined && (!Array.isArray(kinds) || !kinds.length || kinds.length > 3 || kinds.some(kind => !["steps", "heartRate", "sleep"].includes(kind)))) throw new Error("健康数据类型无效"); };
  return {
    location: options => query<{ latitude: number; longitude: number; accuracy: number }>("location", { timeoutMs: 20000, ...options }),
    device: () => query<DeviceInfo>("device"),
    openUrl: url => { if (!url.trim() || url.length > 8192 || !/^[a-z][a-z0-9+.-]*:/i.test(url)) throw new Error("链接无效"); return query("openUrl", { url }); },
    torch: on => query("torch", { on }),
    bluetooth: {
      status: () => query<{ present: boolean; enabled: boolean }>("bluetoothState"),
      pairedDevices: () => query<{ items: BluetoothDevice[] }>("bluetoothDevices"),
      requestPermissions: async () => {
        if (!available()) return cancelled;
        try {
          const permissions = Number(Platform.Version) >= 31 ? [PERMISSIONS.ANDROID.BLUETOOTH_SCAN, PERMISSIONS.ANDROID.BLUETOOTH_CONNECT] : [PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION];
          const statuses = await requestMultiple(permissions);
          return { ok: true as const, granted: permissions.every(permission => statuses[permission] === "granted") };
        } catch { return { ok: false as const, code: "UNAVAILABLE" as const, error: messages.UNAVAILABLE }; }
      },
      scan: (options = {}) => {
        if (options.seconds !== undefined && (!Number.isInteger(options.seconds) || options.seconds < 1 || options.seconds > 15)) throw new Error("扫描时长须为 1–15 秒");
        return query<{ items: BluetoothDevice[] }>("bluetoothScan", options);
      },
      connect: (address, options = {}) => { if (!/^([a-f0-9]{2}:){5}[a-f0-9]{2}$/i.test(address)) throw new Error("蓝牙地址无效"); return query<{ connectionId: string }>("bluetoothConnect", { address: address.toUpperCase(), ...options }); },
      disconnect: connectionId => query("bluetoothDisconnect", { connectionId: connection(connectionId) }),
      services: (connectionId, options = {}) => query<{ items: import("./native-types").BluetoothService[] }>("bluetoothServices", { connectionId: connection(connectionId), ...options }),
      read: (input, options = {}) => query<{ data: string }>("bluetoothRead", { ...characteristic(input), ...options }),
      write: (input, data, options = {}) => { if (!data.length || data.length > 684 || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) || data.length / 4 * 3 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0) > 512) throw new Error("蓝牙写入须为 1–512 字节的原始 Base64"); return query("bluetoothWrite", { ...characteristic(input), data, ...options }); },
      subscribe: (input, options = {}) => query("bluetoothSubscribe", { ...characteristic(input), ...options }),
      unsubscribe: (input, options = {}) => query("bluetoothUnsubscribe", { ...characteristic(input), ...options }),
      onEvent: listener => { if (disposed || typeof listener !== "function") throw new Error("蓝牙监听无效"); bluetoothListeners.add(listener); return () => { bluetoothListeners.delete(listener); }; },
    },
    nfc: {
      status: () => query<{ present: boolean; enabled: boolean }>("nfcStatus"),
      read: (options = {}) => query<NfcTag>("nfcRead", options),
      write: (records, options = {}) => {
        if (!Array.isArray(records) || !records.length || records.length > 64 || JSON.stringify(records).length > 65536) throw new Error("NFC 记录最多64条、64 KiB");
        for (const record of records) if (record.type === "text" ? typeof record.text !== "string" || (record.language?.length ?? 0) > 40 : record.type !== "uri" || typeof record.uri !== "string" || !/^[a-z][a-z0-9+.-]*:/i.test(record.uri)) throw new Error("NFC 仅支持文字和 URI 记录");
        return query<{ id: string }>("nfcWrite", { records, ...options });
      },
    },
    health: {
      status: () => query<{ status: "available" | "update" | "unavailable" }>("healthStatus"),
      permissions: () => query<{ granted: HealthKind[] }>("healthPermissions"),
      requestPermissions: (options = {}) => { healthKinds(options.kinds); return query<{ granted: HealthKind[]; grantedAll: boolean }>("requestHealth", options); },
      summary: (fromMs, toMs, options = {}) => { range(fromMs, toMs); healthKinds(options.kinds); return query<HealthSummary>("healthSummary", { fromMs, toMs, ...options }); },
    },
    keepAwake: on => { if (on && !available()) return Promise.resolve(cancelled); wantsAwake = on; return action("appKeepAwake", { appId, on }); },
    speak: text => { if (!text.trim() || text.length > 100000) throw new Error("朗读文字须为1–100000字"); return operation("speechSpeak", "speechStop", { text, waitForCompletion: false }); },
    stopSpeaking: () => action("speechStop", { appId }),
    speech: {
      finish: () => { speechPreparations.forEach(controller => controller.abort()); return action("speechFinish", { appId }); },
      cancel: () => { speechPreparations.forEach(controller => controller.abort()); return action("speechCancelAll", { appId }); },
      speak: (text, options = {}) => {
        if (!text.trim() || text.length > 100000 || options.voice !== undefined && (!options.voice.trim() || options.voice.length > 200) || options.language !== undefined && (!options.language.trim() || options.language.length > 40) || options.rate !== undefined && (!Number.isFinite(options.rate) || options.rate < 0.25 || options.rate > 2) || options.pitch !== undefined && (!Number.isFinite(options.pitch) || options.pitch < 0.5 || options.pitch > 2)) throw new Error("朗读参数无效");
        return operation("speechSpeak", "speechStop", { text, ...options });
      },
      status: () => shell("speechStatus", { appId }),
      voices: (options = {}) => operation("speechVoices", "speechQueryCancel", options, false) as Promise<NativeValueResult<{ items: import("./native-types").SpeechVoice[] }>>,
      languages: (options = {}) => operation("speechLanguages", "speechQueryCancel", options, false) as Promise<NativeValueResult<{ installed: string[]; supported: string[]; online: string[] }>>,
      requestPermission: async () => { if (!available()) return { granted: false, status: "unavailable" }; const status = await request(PERMISSIONS.ANDROID.RECORD_AUDIO); return { granted: status === "granted", status }; },
      recognize: async (options = {}) => {
        if (options.language !== undefined && (!options.language.trim() || options.language.length > 40)) throw new Error("语音识别语言无效");
        if (!available() || options.signal?.aborted) return cancelled;
        const controller = new AbortController(), abort = () => controller.abort();
        speechPreparations.add(controller); cancellations.set(abort, false); options.signal?.addEventListener("abort", abort);
        try {
          if (options.signal?.aborted) abort();
          if (!await prepareSpeechModel(controller.signal) || controller.signal.aborted || !available()) return cancelled;
        } catch { return { ok: false, code: "UNAVAILABLE", error: "语音模型暂时无法准备，请稍后重试" }; }
        finally { speechPreparations.delete(controller); cancellations.delete(abort); options.signal?.removeEventListener("abort", abort); }
        const result = await operation("speechRecognize", "speechCancel", { ...options });
        return result.ok && "text" in result && typeof result.text === "string" ? { ok: true, text: result.text } : result.ok ? { ok: false, code: "UNAVAILABLE", error: messages.UNAVAILABLE } : result;
      },
    },
    shortcuts: {
      list: () => shell("shortcutList", { appId }),
      status: () => shell("shortcutStatus", { appId }),
      add: async input => {
        if (!/^[A-Za-z0-9._-]{1,60}$/.test(input.id)) throw new Error("快捷入口 ID 无效");
        const details = metadata();
        const label = input.label ?? details.title.slice(0, 40);
        if (!label.trim() || label.length > 40) throw new Error("快捷入口名称须为 1–40 字");
        const path = input.iconPath ? fileUri(input.iconPath).replace(/^file:\/\//, "") : undefined;
        return available() ? action("shortcutAdd", { appId, id: input.id, label, params: normalizeShareParams(input.params), path, accent: details.accent }) : cancelled;
      },
      remove: id => { if (!/^[A-Za-z0-9._-]{1,60}$/.test(id)) throw new Error("快捷入口 ID 无效"); return action("shortcutRemove", { appId, id }); },
    },
    widgets: {
      status: () => shell("widgetStatus", { appId }),
      list: () => shell("widgetList", { appId }),
      set: input => {
        if (!/^[A-Za-z0-9._-]{1,60}$/.test(input.id) || !input.title.trim() || input.title.length > 60 || (input.body?.length ?? 0) > 500 || input.progress !== undefined && (!Number.isFinite(input.progress) || input.progress < 0 || input.progress > 1)) throw new Error("小组件参数无效");
        for (const color of [input.backgroundColor, input.textColor]) if (color !== undefined && !/^#[a-f0-9]{6}$/i.test(color)) throw new Error("颜色需为 #RRGGBB");
        const { imagePath, ...value } = input;
        return action("widgetSet", { appId, ...value, params: normalizeShareParams(input.params), path: imagePath ? fileUri(imagePath).replace(/^file:\/\//, "") : undefined });
      },
      pin: id => { if (!/^[A-Za-z0-9._-]{1,60}$/.test(id)) throw new Error("小组件 ID 无效"); return available() ? action("widgetPin", { appId, id }) : Promise.resolve(cancelled); },
      remove: id => { if (!/^[A-Za-z0-9._-]{1,60}$/.test(id)) throw new Error("小组件 ID 无效"); return action("widgetRemove", { appId, id }); },
    },
    calendar: {
      events: (fromMs, toMs, options = {}) => {
        range(fromMs, toMs);
        if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 200) || options.offset !== undefined && (!Number.isInteger(options.offset) || options.offset < 0)) throw new Error("日历分页参数无效");
        return query<{ items: CalendarEvent[]; nextOffset: number | null }>("calendarEvents", { fromMs, toMs, ...options });
      },
      insert: (input, options = {}) => {
        if (!input.title.trim() || input.title.length > 200 || !Number.isSafeInteger(input.startMs) || !Number.isSafeInteger(input.endMs) || input.startMs <= 0 || input.endMs <= input.startMs || input.allDay && (input.startMs % 86400000 !== 0 || input.endMs % 86400000 !== 0)) throw new Error("日历参数无效");
        return query<{ id: string }>("calendarInsert", { ...input, ...options });
      },
      remove: (id, options = {}) => { if (!/^[1-9][0-9]*$/.test(id)) throw new Error("日历事件 ID 无效"); return query<{ removed: boolean }>("calendarRemove", { id, ...options }); },
      compose: input => {
        if (!input.title.trim() || input.title.length > 200 || !Number.isSafeInteger(input.startMs) || !Number.isSafeInteger(input.endMs) || input.startMs <= 0 || input.endMs <= input.startMs) throw new Error("日历事件名称或时间无效");
        if (input.allDay && (input.startMs % 86400000 !== 0 || input.endMs % 86400000 !== 0)) throw new Error("全天事件请使用 UTC 零点的日期边界");
        return available() ? action("calendarCompose", { appId, ...input }) : Promise.resolve(cancelled);
      },
    },
    sensors: {
      available: () => shell("sensorStatus", { appId }),
      subscribe: (kind, listener, options = {}) => {
        const intervalMs = options.intervalMs ?? 50;
        if (!["accelerometer", "gyroscope", "gravity", "rotation"].includes(kind) || typeof listener !== "function" || !Number.isInteger(intervalMs) || intervalMs < 20 || intervalMs > 1000) throw new Error("传感器参数无效，采样间隔为 20–1000 ms");
        if (disposed) throw new Error("应用已卸载");
        if (sensors.size >= 4) throw new Error("每个应用最多4个传感器订阅");
        const requestId = newId(), item = { kind, listener, intervalMs, onError: options.onError };
        sensors.set(requestId, item); startSensor(requestId, item);
        return () => { sensors.delete(requestId); sensorChain = sensorChain.then(() => action("sensorStop", { appId, requestId })); };
      },
    },
    biometrics: {
      status: () => shell("biometricStatus", { appId }),
      authenticate: (options = {}) => operation("biometricAuthenticate", "biometricCancel", { ...options }),
    },
  };
}
