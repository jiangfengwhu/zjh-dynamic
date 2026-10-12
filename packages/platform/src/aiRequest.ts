import { pluginCall } from "./pluginHost";

type Provider = { id: string; baseUrl: string; model: string; isDefault: boolean };
type Request = { providerId?: string; model?: string; protocol?: "chat-completions" | "responses"; messages: { role: string; content: string | object[] }[]; temperature?: number; maxTokens?: number };

export function aiProtocol(input: Request) {
  return input.protocol ?? (input.messages.some(message => Array.isArray(message.content) && message.content.some(part => (part as { type?: string }).type === "file")) ? "responses" : "chat-completions");
}

/** Request protocol belongs to RN. Native only adds the stored credential and transports the body. */
export function aiRequestBody(input: Request, model: string, stream: boolean) {
  if (aiProtocol(input) === "responses") return { model, store: false, stream,
    input: input.messages.map(message => ({ role: message.role, content: typeof message.content === "string" ? message.content : message.content.map(value => {
      const part = value as { type: string; text?: string; image_url?: { url: string; detail?: string }; file?: Record<string, string> };
      if (part.type === "text") return { type: message.role === "assistant" ? "output_text" : "input_text", text: part.text };
      if (part.type === "image_url") return { type: "input_image", image_url: part.image_url!.url, detail: part.image_url!.detail ?? "auto" };
      if (part.type === "file") return { type: "input_file", ...part.file };
      throw new Error("Responses 暂不支持此附件；音频请使用 chat-completions");
    }) })),
    ...(input.temperature === undefined ? {} : { temperature: input.temperature }),
    ...(input.maxTokens === undefined ? {} : { max_output_tokens: input.maxTokens }),
  };
  if (input.messages.some(message => Array.isArray(message.content) && message.content.some(part => (part as { file?: Record<string, string> }).file?.file_url))) throw new Error("文件 URL 需要 Responses 协议");
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
  try {
    const protocol = aiProtocol(input);
    return { ok: true as const, providerId: chosen.id, protocol,
      path: protocol === "responses" ? "/responses" : "/chat/completions",
      body: aiRequestBody(input, model, stream), stream,
    };
  } catch (error) { return { ok: false as const, code: "INVALID_REQUEST" as const, error: error instanceof Error ? error.message : "AI 附件参数无效" }; }
}
