import { pluginCall } from "./pluginHost";

type Provider = { id: string; baseUrl: string; model: string; isDefault: boolean };
type Request = { providerId?: string; model?: string; messages: { role: string; content: string | object[] }[]; temperature?: number; maxTokens?: number };

/** Request protocol belongs to RN. Native only adds the stored credential and transports the body. */
export function aiRequestBody(input: Request, model: string, stream: boolean) {
  return { model, messages: input.messages, stream,
    ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
    ...(input.maxTokens === undefined ? {} : { max_tokens: input.maxTokens }),
  };
}

export async function prepareAiRequest(input: Request, stream: boolean) {
  const result = await pluginCall<{ ok: boolean; items?: Provider[] }>("shell", "providers", {});
  if (!result.ok || !Array.isArray(result.items)) throw new Error("AI 配置读取失败");
  const chosen = input.providerId ? result.items.find(item => item.id === input.providerId)
    : result.items.find(item => item.isDefault) ?? result.items[0];
  if (!chosen) return input.providerId
    ? { ok: false as const, code: "PROVIDER_NOT_FOUND" as const, error: "选定的 AI 引擎已移除，请重新选择" }
    : { ok: false as const, code: "NOT_CONFIGURED" as const, error: "请先在我的页面配置 AI 引擎" };
  const model = input.model?.trim() || chosen.model;
  if (!model) return { ok: false as const, code: "INVALID_REQUEST" as const, error: "请配置 AI 模型" };
  return { ok: true as const, providerId: chosen.id,
    path: chosen.baseUrl.trim().replace(/\/+$/, "").endsWith("/chat/completions") ? "" : "/chat/completions",
    body: aiRequestBody(input, model, stream), stream,
  };
}
