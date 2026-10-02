import type { AiCompletionRequest, AiCompletionResult, AiProvider, AiService } from "./ai-types";
import { shell } from "../../platform/src/phone";

let inFlight = 0;
export function applicationAi(openSettings: () => void): AiService {
  let applicationInFlight = 0;
  return {
    openSettings,
    listProviders: async () => {
      const result = await shell<{ ok: boolean; items?: AiProvider[] }>("providers");
      if (!result.ok || !Array.isArray(result.items)) throw new Error("暂时无法读取 AI 配置");
      // Return an explicit allowlist even when running with an older native host.
      return result.items.map(({ id, name, model, isDefault }) => ({ id, name, model, isDefault }));
    },
    complete: async (request: AiCompletionRequest): Promise<AiCompletionResult> => {
      if (!request || !Array.isArray(request.messages) || !request.messages.length || request.messages.length > 128 || request.messages.some(message => !message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string") || request.messages.reduce((count, message) => count + message.content.length, 0) > 128000 || request.providerId !== undefined && (typeof request.providerId !== "string" || !request.providerId.trim() || request.providerId.length > 100) || request.temperature !== undefined && (!Number.isFinite(request.temperature) || request.temperature < 0 || request.temperature > 2) || request.maxTokens !== undefined && (!Number.isInteger(request.maxTokens) || request.maxTokens < 1 || request.maxTokens > 8192)) return { ok: false, code: "INVALID_REQUEST", error: "AI 请求参数无效" };
      if (applicationInFlight >= 2 || inFlight >= 4) return { ok: false, code: "BUSY", error: "AI 正在处理其他请求，请稍后重试" };
      applicationInFlight++; inFlight++;
      try {
        const result = await shell<AiCompletionResult>("complete", {
          messages: request.messages.map(({ role, content }) => ({ role, content })),
          ...(request.providerId ? { providerId: request.providerId } : {}),
          ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          ...(request.maxTokens !== undefined ? { maxTokens: request.maxTokens } : {}),
        });
        if (result.ok) {
          if (typeof result.text !== "string" || !result.text.trim() || !result.providerId || !result.model) return { ok: false, code: "INVALID_RESPONSE", error: "模型未返回可用文本，请重试" };
          return { ok: true, text: result.text, providerId: result.providerId, model: result.model };
        }
        return result.code ? { ok: false, code: result.code, error: result.error } : { ok: false, code: "PROVIDER_ERROR", error: "模型调用失败，请检查 AI 配置" };
      } catch { return { ok: false, code: "NETWORK_ERROR", error: "暂时无法调用 AI，请稍后重试" }; }
      finally { applicationInFlight--; inFlight--; }
    },
  };
}
