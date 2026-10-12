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
      } else if (attachment.type === "file") {
        const sources = ["data", "fileId", "url"].filter(key => key in attachment);
        if (sources.length !== 1) throw new Error("文件必须且只能提供 data、fileId、url 之一");
        if ("data" in attachment) {
          if (typeof attachment.name !== "string" || !attachment.name.trim() || attachment.name.length > 200 || /[\\/\u0000-\u001f\u007f]/.test(attachment.name)) throw new Error("文件名无效");
          if (typeof attachment.mime !== "string" || attachment.mime.length > 160 || !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(attachment.mime)) throw new Error("文件 MIME 类型无效");
          if (typeof attachment.data !== "string" || !attachment.data.length || attachment.data.length > 8 * 1024 * 1024 || attachment.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(attachment.data)) throw new Error("文件须为不带前缀的 base64，最大 6 MB");
          mediaSize += attachment.data.length;
          content.push({ type: "file", file: { filename: attachment.name, file_data: `data:${attachment.mime};base64,${attachment.data}` } });
        } else if ("fileId" in attachment) {
          if (typeof attachment.fileId !== "string" || !/^[A-Za-z0-9._-]{1,200}$/.test(attachment.fileId)) throw new Error("文件 ID 无效");
          content.push({ type: "file", file: { file_id: attachment.fileId } });
        } else if ("url" in attachment) {
          if (typeof attachment.url !== "string" || attachment.url.length > 4096) throw new Error("文件地址无效");
          const url = new URL(attachment.url);
          if (url.protocol !== "https:" || url.username || url.password) throw new Error("文件地址必须为 HTTPS");
          mediaSize += attachment.url.length;
          content.push({ type: "file", file: { file_url: attachment.url } });
        }
      } else throw new Error("附件类型无效");
      if (mediaSize > 8 * 1024 * 1024) throw new Error("附件总量不能超过 8 MB");
    }
    return { role: message.role, content };
  });
}
