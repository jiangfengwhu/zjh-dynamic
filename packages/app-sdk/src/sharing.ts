import type { ShareParams, ApplicationShareInput } from "./index";

/** Validate before crossing a link, storage or native boundary. */
export function normalizeShareParams(value: unknown): ShareParams | undefined {
  if (value === undefined) return;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("分享参数必须是 JSON 对象");
  function check(item: unknown, depth: number): void {
    if (depth > 8) throw new Error("分享参数嵌套过深");
    if (item === null || typeof item === "string" || typeof item === "boolean" || typeof item === "number" && Number.isFinite(item)) return;
    if (typeof item !== "object" || !item || !Array.isArray(item) && Object.getPrototypeOf(item) !== Object.prototype && Object.getPrototypeOf(item) !== null) throw new Error("分享参数必须是 JSON 数据");
    Object.values(item).forEach(child => check(child, depth + 1));
  }
  check(value, 0);
  const json = JSON.stringify(value);
  let bytes = 0;
  for (const char of json) { const code = char.codePointAt(0)!; bytes += code <= 127 ? 1 : code <= 2047 ? 2 : code <= 65535 ? 3 : 4; }
  if (bytes > 4096) throw new Error("分享参数最多 4096 字节");
  return JSON.parse(json);
}
let handler: (appId: string, input: ApplicationShareInput) => Promise<void> = async () => { throw new Error("分享入口尚未就绪"); };
const params = new Map<string, ShareParams>();
const listeners = new Map<string, Set<(params: ShareParams | undefined) => void>>();
export function setApplicationSharingHandler(next: typeof handler) { handler = next; }
export function receiveApplicationShare(appId: string, value?: ShareParams) {
  const next = normalizeShareParams(value);
  if (next) params.set(appId, next); else params.delete(appId);
  const recipients = [...(listeners.get(appId) ?? [])];
  void Promise.resolve().then(() => recipients.forEach(listener => { if (!listeners.get(appId)?.has(listener)) return; try { listener(normalizeShareParams(next)); } catch { console.warn("分享参数接收失败"); } }));
}
export function clearApplicationShareListeners(appId: string) { listeners.delete(appId); }
export function applicationSharing(appId: string) {
  return {
    open: async (input: ApplicationShareInput = {}) => {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("分享内容无效");
      if (input.title !== undefined && (typeof input.title !== "string" || input.title.length > 200) || input.description !== undefined && (typeof input.description !== "string" || input.description.length > 1000)) throw new Error("分享标题或简介过长");
      await handler(appId, { ...input, params: normalizeShareParams(input.params) });
    },
    getParams: () => normalizeShareParams(params.get(appId)),
    subscribe: (listener: (value: ShareParams | undefined) => void) => {
      let group = listeners.get(appId);
      if (!group) { group = new Set(); listeners.set(appId, group); }
      group.add(listener);
      return () => { group!.delete(listener); if (!group!.size && listeners.get(appId) === group) listeners.delete(appId); };
    },
  };
}
