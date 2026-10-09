import { aiMessages } from "./ai-input";
import { DeviceEventEmitter } from "react-native";
import type { AiCompletionRequest, AiCompletionResult, AiProvider, AiService, AiRequestOptions, AiStreamOptions } from "./ai-types";
import { shell } from "../../platform/src/phone";
import { prepareAiRequest } from "../../platform/src/aiRequest";
let inFlight = 0;
let sequence = 0;
const cancelled = (): AiCompletionResult => ({ ok: false, code: "CANCELLED", error: "已取消生成" });
export function applicationAi(openSettings: () => void): AiService {
  let applicationInFlight = 0;
  async function generate(request: AiCompletionRequest, options?: AiRequestOptions, onText?: (text: string) => void): Promise<AiCompletionResult> {
    let messages: ReturnType<typeof aiMessages>;
    try { messages = aiMessages(request?.messages); } catch { return { ok: false, code: "INVALID_REQUEST", error: "AI 消息或附件无效" }; }
    if (request.providerId !== undefined && (typeof request.providerId !== "string" || !request.providerId.trim() || request.providerId.length > 100) || request.temperature !== undefined && (!Number.isFinite(request.temperature) || request.temperature < 0 || request.temperature > 2) || request.maxTokens !== undefined && (!Number.isInteger(request.maxTokens) || request.maxTokens < 1 || request.maxTokens > 8192)) return { ok: false, code: "INVALID_REQUEST", error: "AI 请求参数无效" };
    if (options?.signal?.aborted) return cancelled();
    if (applicationInFlight >= 2 || inFlight >= 4) return { ok: false, code: "BUSY", error: "AI 正在处理其他请求，请稍后重试" };
    const requestId = `ai-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`;
    let aborted = false, text = "", callbackFailed = false;
    let resolveAbort: (result: AiCompletionResult) => void = () => {};
    const cancellation = new Promise<AiCompletionResult>(resolve => { resolveAbort = resolve; });
    const abort = () => { if (aborted) return; aborted = true; resolveAbort(cancelled()); void shell("completeCancel", { requestId }).catch(() => {}); };
    const subscription = onText ? DeviceEventEmitter.addListener("zijinhua.ai.text", (event: { requestId: string; delta: string }) => {
      if (event.requestId !== requestId || aborted || typeof event.delta !== "string") return;
      text += event.delta;
      try { onText(text); } catch { callbackFailed = true; abort(); }
    }) : undefined;
    options?.signal?.addEventListener("abort", abort);
    if (options?.signal?.aborted) abort();
    applicationInFlight++; inFlight++;
    const native = (async (): Promise<AiCompletionResult> => {
      try {
        const prepared = await prepareAiRequest({ ...request, messages }, Boolean(onText));
        if (aborted) return cancelled();
        if (!prepared.ok) return prepared;
        const result = await shell<AiCompletionResult>("complete", {
          requestId, providerId: prepared.providerId, path: prepared.path,
          stream: prepared.stream, body: prepared.body,
        });
        if (aborted) return cancelled();
        if (result.ok) {
          if (typeof result.text !== "string" || !result.text.trim() || !result.providerId || !result.model) return { ok: false, code: "INVALID_RESPONSE", error: "模型未返回可用文本，请重试" };
          if (onText && text !== result.text) { text = result.text; try { onText(text); } catch { return { ok: false, code: "INVALID_REQUEST", error: "流式文本处理失败" }; } }
          return { ok: true, text: result.text, providerId: result.providerId, model: result.model };
        }
        return result.code ? { ok: false, code: result.code, error: result.error } : { ok: false, code: "PROVIDER_ERROR", error: "模型调用失败，请检查 AI 配置" };
      } catch { return aborted ? cancelled() : { ok: false, code: "NETWORK_ERROR", error: "暂时无法调用 AI，请稍后重试" }; }
      finally { applicationInFlight--; inFlight--; subscription?.remove(); options?.signal?.removeEventListener("abort", abort); }
    })();
    const result = await Promise.race([native, cancellation]);
    if (aborted) { subscription?.remove(); options?.signal?.removeEventListener("abort", abort); }
    return callbackFailed ? { ok: false, code: "INVALID_REQUEST", error: "流式文本处理失败" } : result;
  }
  return {
    openSettings,
    listProviders: async () => {
      const result = await shell<{ ok: boolean; items?: AiProvider[] }>("providers");
      if (!result.ok || !Array.isArray(result.items)) throw new Error("暂时无法读取 AI 配置");
      return result.items.map(({ id, name, model, isDefault }) => ({ id, name, model, isDefault }));
    },
    complete: (request, options) => generate(request, options),
    stream: (request: AiCompletionRequest, options: AiStreamOptions) => typeof options?.onText === "function" ? generate(request, options, options.onText) : Promise.resolve({ ok: false, code: "INVALID_REQUEST", error: "请提供流式文本回调" }),
  };
}
