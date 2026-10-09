import type { AiMessage } from "./ai-types";

/** Keep plain-text requests byte-for-byte compatible with the existing bridge. */
export function aiMessages(messages: AiMessage[]): { role: string; content: string | object[] }[] {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 128) throw new Error("消息数量无效");
  let characters = 0, attachments = 0, mediaSize = 0;
  return messages.map(message => {
    if (!message || !["system", "user", "assistant"].includes(message.role) || typeof message.content !== "string") throw new Error("消息无效");
    characters += message.content.length;
    if (characters > 128000) throw new Error("文本过长");
    if (message.attachments === undefined) return { role: message.role, content: message.content };
    if (!Array.isArray(message.attachments) || message.role !== "user" && message.attachments.length) throw new Error("附件只支持用户消息");
    if (!message.attachments.length) return { role: message.role, content: message.content };
    const content: object[] = message.content ? [{ type: "text", text: message.content }] : [];
    for (const attachment of message.attachments) {
      if (++attachments > 16 || !attachment) throw new Error("附件过多");
      if (attachment.type === "image") {
        if (typeof attachment.url !== "string") throw new Error("图片地址无效");
        if (attachment.url.startsWith("https://")) {
          const url = new URL(attachment.url);
          if (url.username || url.password || attachment.url.length > 4096) throw new Error("图片地址无效");
        } else if (!/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(attachment.url)) throw new Error("图片只支持 HTTPS 或 base64 图片");
        if (attachment.detail !== undefined && !["auto", "low", "high"].includes(attachment.detail)) throw new Error("图片精度无效");
        mediaSize += attachment.url.length;
        content.push({ type: "image_url", image_url: { url: attachment.url, ...(attachment.detail ? { detail: attachment.detail } : {}) } });
      } else if (attachment.type === "audio") {
        if (!["wav", "mp3"].includes(attachment.format) || typeof attachment.data !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(attachment.data)) throw new Error("音频格式无效");
        mediaSize += attachment.data.length;
        content.push({ type: "input_audio", input_audio: { data: attachment.data, format: attachment.format } });
      } else throw new Error("附件类型无效");
      if (mediaSize > 8 * 1024 * 1024) throw new Error("附件总量不能超过 8 MB");
    }
    return { role: message.role, content };
  });
}
