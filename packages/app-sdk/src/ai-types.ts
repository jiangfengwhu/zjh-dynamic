export type AiProvider = { id: string; name: string; model: string; isDefault: boolean };
export type AiAttachment =
  | { type: "image"; url: string; detail?: "auto" | "low" | "high" }
  | { type: "audio"; data: string; format: "wav" | "mp3" };
export type AiMessage = { role: "system" | "user" | "assistant"; content: string; /** Only user messages; the chosen model must support the supplied modality. */ attachments?: AiAttachment[] };
export type AiCompletionRequest = { messages: AiMessage[]; providerId?: string; temperature?: number; maxTokens?: number };
export type AiErrorCode = "NOT_CONFIGURED" | "PROVIDER_NOT_FOUND" | "INVALID_REQUEST" | "AUTH_FAILED" | "RATE_LIMITED" | "TIMEOUT" | "NETWORK_ERROR" | "INVALID_RESPONSE" | "PROVIDER_ERROR" | "BUSY" | "CANCELLED";
export type AiRequestOptions = { signal?: AbortSignal };
export type AiStreamOptions = AiRequestOptions & { /** Receives accumulated text, not just the latest token. */ onText: (text: string) => void };
export type AiCompletionResult =
  | { ok: true; text: string; providerId: string; model: string }
  | { ok: false; code: AiErrorCode; error: string };
export type AiService = {
  listProviders: () => Promise<AiProvider[]>;
  complete: (request: AiCompletionRequest, options?: AiRequestOptions) => Promise<AiCompletionResult>;
  stream: (request: AiCompletionRequest, options: AiStreamOptions) => Promise<AiCompletionResult>;
  openSettings: () => void;
};
