import { AppState, DeviceEventEmitter } from "react-native";
import { PERMISSIONS, request } from "react-native-permissions";
import { shell } from "../../platform/src/phone";
import { normalizeShareParams } from "./sharing";
import type { ApplicationNativeCapabilities, NativeActionResult, NativeErrorCode, SensorKind, SensorSample } from "./native-types";

const bindings = new Map<string, { visibility: (delta: number) => void; clear: () => void }>();
let sequence = 0;
const cancelled: NativeActionResult = { ok: false, code: "CANCELLED", error: "已取消" };
const codes: Record<string, NativeErrorCode> = { cancel: "CANCELLED", permission: "PERMISSION", unsupported: "UNSUPPORTED", busy: "BUSY", timeout: "TIMEOUT", "no-match": "NO_MATCH", network: "NETWORK" };
const messages: Record<NativeErrorCode, string> = { CANCELLED: "已取消", PERMISSION: "请先授予麦克风权限", UNSUPPORTED: "设备不支持此能力", BUSY: "正在处理其他操作", TIMEOUT: "操作超时，请重试", NO_MATCH: "未识别到语音，请重试", NETWORK: "语音服务网络不可用", UNAVAILABLE: "暂时不可用，请检查系统设置" };
async function action(method: string, payload: Record<string, unknown>): Promise<NativeActionResult & Record<string, unknown>> {
  try {
    const value = await shell<{ ok: boolean; error?: string } & Record<string, unknown>>(method, payload);
    if (value.ok) return value as { ok: true } & Record<string, unknown>;
    const code = codes[value.error ?? ""] ?? "UNAVAILABLE";
    return { ok: false, code, error: messages[code] };
  } catch { return { ok: false, code: "UNAVAILABLE", error: messages.UNAVAILABLE }; }
}
export function setApplicationNativeActive(appId: string, active: boolean) { bindings.get(appId)?.visibility(active ? 1 : -1); }
export function clearApplicationNative(appId: string) { bindings.get(appId)?.clear(); bindings.delete(appId); }

export function applicationNative(appId: string, metadata: () => { title: string; accent: string }, fileUri: (path: string) => string): ApplicationNativeCapabilities {
  let visible = 0, disposed = false, foreground = AppState.currentState === "active";
  let sensorChain: Promise<unknown> = Promise.resolve();
  type SensorSubscription = { kind: SensorKind; listener: (sample: SensorSample) => void; intervalMs: number; onError?: (error: Extract<NativeActionResult, { ok: false }>) => void };
  const sensors = new Map<string, SensorSubscription>();
  const cancellations = new Map<() => void, boolean>();
  const newId = () => `${Date.now()}-${++sequence}`;
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
  };
  const resume = () => { if (available()) sensors.forEach((item, id) => startSensor(id, item)); };
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
    visibility: delta => { const was = available(); visible = Math.max(0, visible + delta); if (was && !available()) suspend(); else if (!was && available()) resume(); },
    clear: () => { disposed = true; suspend(); sensors.clear(); events.remove(); stateListener.remove(); },
  });
  async function operation(method: string, stop: string, options: { signal?: AbortSignal; onPartial?: (text: string) => void } & Record<string, unknown>) {
    if (!available() || options.signal?.aborted) return cancelled;
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
    const event = options.onPartial ? DeviceEventEmitter.addListener("zijinhua.app.native", value => {
      if (aborted || !available() || value.appId !== appId || value.requestId !== requestId || value.kind !== "speech") return;
      try { options.onPartial?.(value.text); } catch { abort(); }
    }) : undefined;
    const { signal, onPartial, ...input } = options;
    const native = action(method, { appId, requestId, ...input });
    cancellations.set(abort, method === "biometricAuthenticate"); signal?.addEventListener("abort", abort);
    if (signal?.aborted) abort();
    try { return await Promise.race([native, cancellation]); }
    finally { cancellations.delete(abort); event?.remove(); signal?.removeEventListener("abort", abort); }
  }
  return {
    speak: text => { if (!text.trim()) throw new Error("朗读文字不能为空"); return operation("speechSpeak", "speechStop", { text, waitForCompletion: false }); },
    stopSpeaking: () => action("speechStop", { appId }),
    speech: {
      speak: (text, options = {}) => {
        if (!text.trim() || options.language !== undefined && (!options.language.trim() || options.language.length > 40) || options.rate !== undefined && (!Number.isFinite(options.rate) || options.rate < 0.25 || options.rate > 2) || options.pitch !== undefined && (!Number.isFinite(options.pitch) || options.pitch < 0.5 || options.pitch > 2)) throw new Error("朗读参数无效");
        return operation("speechSpeak", "speechStop", { text, ...options });
      },
      status: () => shell("speechStatus", { appId }),
      requestPermission: async () => { if (!available()) return { granted: false, status: "unavailable" }; const status = await request(PERMISSIONS.ANDROID.RECORD_AUDIO); return { granted: status === "granted", status }; },
      recognize: async (options = {}) => {
        if (options.language !== undefined && (!options.language.trim() || options.language.length > 40)) throw new Error("语音识别语言无效");
        const result = await operation("speechRecognize", "speechCancel", { ...options });
        return result.ok && "text" in result && typeof result.text === "string" ? { ok: true, text: result.text } : result.ok ? { ok: false, code: "UNAVAILABLE", error: messages.UNAVAILABLE } : result;
      },
    },
    shortcuts: {
      status: () => shell("shortcutStatus", { appId }),
      add: async input => {
        if (!/^[A-Za-z0-9._-]{1,60}$/.test(input.id)) throw new Error("快捷入口 ID 无效");
        const details = metadata();
        const label = input.label ?? details.title.slice(0, 40);
        if (!label.trim() || label.length > 40) throw new Error("快捷入口名称须为 1–40 字");
        const path = input.iconPath ? fileUri(input.iconPath).replace(/^file:\/\//, "") : undefined;
        return action("shortcutAdd", { appId, id: input.id, label, params: normalizeShareParams(input.params), path, accent: details.accent });
      },
      remove: id => { if (!/^[A-Za-z0-9._-]{1,60}$/.test(id)) throw new Error("快捷入口 ID 无效"); return action("shortcutRemove", { appId, id }); },
    },
    calendar: {
      compose: input => {
        if (!input.title.trim() || input.title.length > 200 || !Number.isSafeInteger(input.startMs) || !Number.isSafeInteger(input.endMs) || input.startMs <= 0 || input.endMs <= input.startMs) throw new Error("日历事件名称或时间无效");
        if (input.allDay && (input.startMs % 86400000 !== 0 || input.endMs % 86400000 !== 0)) throw new Error("全天事件请使用 UTC 零点的日期边界");
        return action("calendarCompose", { appId, ...input });
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
