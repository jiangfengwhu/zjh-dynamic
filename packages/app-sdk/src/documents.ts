import { shell } from "../../platform/src/phone";
import type { NativeActionResult } from "./native-types";
let sequence = 0;
const cancelled: NativeActionResult = { ok: false, code: "CANCELLED", error: "已取消" };
/** Native operations own their timeout and cancellation; no large binary data crosses the bridge. */
export async function documentAction(appId: string, method: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<NativeActionResult & Record<string, unknown>> {
  if (signal?.aborted) return cancelled;
  const requestId = `${Date.now()}-${++sequence}`;
  let resolveAbort: (value: NativeActionResult) => void = () => {};
  const aborted = new Promise<NativeActionResult>(resolve => { resolveAbort = resolve; });
  const cancel = () => { resolveAbort(cancelled); void shell("documentCancel", { appId, requestId }).catch(() => {}); };
  try {
    const pending = shell<{ ok: boolean; error?: string } & Record<string, unknown>>(method, { appId, requestId, ...input }).then((value): NativeActionResult & Record<string, unknown> => {
      if (value.ok) return value as { ok: true } & Record<string, unknown>;
      const code = value.error === "cancel" ? "CANCELLED" : value.error === "timeout" ? "TIMEOUT" : value.error === "busy" ? "BUSY" : value.error === "unsupported" ? "UNSUPPORTED" : "UNAVAILABLE";
      return { ok: false as const, code, error: ({ CANCELLED: "已取消", TIMEOUT: "处理超时，请重试", BUSY: "正在处理其他文档", UNSUPPORTED: "设备不支持此能力", UNAVAILABLE: "文档处理失败，请检查文件" } as const)[code] };
    }).catch(() => ({ ok: false as const, code: "UNAVAILABLE" as const, error: "文档处理失败，请重试" }));
    signal?.addEventListener("abort", cancel); if (signal?.aborted) cancel();
    return await Promise.race([pending, aborted]);
  } finally { signal?.removeEventListener("abort", cancel); }
}
