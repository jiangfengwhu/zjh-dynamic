import { workshopContext } from "../workshopContext";
import { currentAccountId } from "../account";
import { htmlByteLength } from "./postDraft";

export async function polishPost(source: string, format: "text" | "html", signal: AbortSignal) {
  const owner = await currentAccountId();
  if (!owner) throw new Error("请先登录后润色");
  const ai = workshopContext().ai;
  if (!(await ai.listProviders()).length) throw new Error("请先配置 AI 引擎，原文已保留");
  if (signal.aborted || await currentAccountId() !== owner) throw new Error("润色已取消，原文已保留");
  const result = await ai.complete({ messages: [
    { role: "system", content: "你是动态发文润色助手。保留用户原意、语气和事实，不编造经历，不新增无关内容。只输出可直接发布的正文，不输出解释或代码围栏。" +
      (format === "html" ? "当前格式为 HTML：输出 HTML 片段，保留原有图片与链接，可优化排版及内联样式；不包含脚本、事件属性、iframe、外部样式表或完整页面壳。最多 32768 UTF-8 字节。" : "当前格式为文字：只输出纯文本，不使用 HTML 标签。最多 2000 字。") },
    { role: "user", content: source },
  ] }, { signal });
  if (signal.aborted) throw new Error("润色已取消");
  if (await currentAccountId() !== owner) throw new Error("账号已改变，原文已保留");
  if (!result.ok) throw new Error(result.error);
  const text = result.text.trim();
  if (!text || (format === "html" ? htmlByteLength(text) > 32768 : Array.from(text).length > 2000)) throw new Error("润色结果超出发文长度限制，原文已保留");
  return text;
}
