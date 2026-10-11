import { shell } from "../../platform/src/phone";
import type { NativeActionResult } from "./native-types";
import { nativeResult } from "./native-result";
let sequence = 0;
const cancelled: NativeActionResult = { ok: false, code: "CANCELLED", error: "已取消" };
/** Native operations own their timeout and cancellation; no large binary data crosses the bridge. */
export async function documentAction(appId: string, method: string, input: Record<string, unknown>, signal?: AbortSignal, cancelMethod = "documentCancel"): Promise<NativeActionResult & Record<string, unknown>> {
  if (signal?.aborted) return cancelled;
  const requestId = `document-${Date.now()}-${++sequence}`;
  let resolveAbort: (value: NativeActionResult) => void = () => {};
  const aborted = new Promise<NativeActionResult>(resolve => { resolveAbort = resolve; });
  const cancel = () => { resolveAbort(cancelled); void shell(cancelMethod, { appId, requestId }).catch(() => {}); };
  try {
    const pending = shell<{ ok: boolean; error?: string } & Record<string, unknown>>(method, { ...input, appId, requestId }).then((value): NativeActionResult & Record<string, unknown> => {
      return nativeResult(value);
    }).catch(() => ({ ok: false as const, code: "UNAVAILABLE" as const, error: "文档处理失败，请重试" }));
    signal?.addEventListener("abort", cancel); if (signal?.aborted) cancel();
    return await Promise.race([pending, aborted]);
  } finally { signal?.removeEventListener("abort", cancel); }
}
