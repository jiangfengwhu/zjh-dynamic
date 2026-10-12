import type { NativeActionResult, NativeErrorCode } from "./native-types";

const codes: Record<string, NativeErrorCode> = { cancel: "CANCELLED", permission: "PERMISSION", unsupported: "UNSUPPORTED", busy: "BUSY", timeout: "TIMEOUT", "no-match": "NO_MATCH", network: "NETWORK", disabled: "DISABLED", "too-large": "TOO_LARGE", language: "LANGUAGE_UNSUPPORTED", "missing-data": "MISSING_DATA", "read-only": "READ_ONLY", "tag-lost": "TAG_LOST", disconnected: "CONNECTION_LOST", rejected: "REJECTED", "not-found": "NOT_FOUND", exists: "ALREADY_EXISTS" };
export const nativeMessages: Record<NativeErrorCode, string> = { CANCELLED: "已取消", PERMISSION: "请先授予此操作需要的权限", UNSUPPORTED: "设备不支持此能力", BUSY: "正在处理其他操作", TIMEOUT: "操作超时，请重试", NO_MATCH: "未识别到语音，请重试", NETWORK: "服务网络不可用", DISABLED: "请先打开系统开关", TOO_LARGE: "内容超过大小限制", UNAVAILABLE: "暂时不可用，请检查系统设置", LANGUAGE_UNSUPPORTED: "系统语音服务不支持此语言或音色", MISSING_DATA: "系统尚未安装此语言的数据", READ_ONLY: "目标只读，无法写入", TAG_LOST: "标签已移开，请重新靠近", CONNECTION_LOST: "蓝牙连接已断开，请重新连接", REJECTED: "设备拒绝此操作", NOT_FOUND: "目标不存在", ALREADY_EXISTS: "目标文件已存在" };
export function nativeResult(value: { ok: boolean; error?: string } & Record<string, unknown>): NativeActionResult & Record<string, unknown> {
  if (value.ok) return value as { ok: true } & Record<string, unknown>;
  if (value.error === "encrypted-document") return { ok: false, code: "UNAVAILABLE", error: "文档已加密或禁止提取，请先解除保护" };
  if (value.error === "invalid-document") return { ok: false, code: "UNAVAILABLE", error: "无法解析文档，请重新导出 PDF 或 Word 文件" };
  if (value.error === "document-format") return { ok: false, code: "UNSUPPORTED", error: "正文提取仅支持 PDF、DOCX 和 DOC" };
  if (value.error === "microphone-permission") return { ok: false, code: "PERMISSION", error: "未授予麦克风权限，请在系统设置中允许生花使用麦克风" };
  if (value.error === "speech-permission") return { ok: false, code: "PERMISSION", error: "系统语音识别服务返回权限错误，请检查系统语音服务设置" };
  const code = codes[value.error ?? ""] ?? "UNAVAILABLE";
  return { ok: false, code, error: nativeMessages[code] };
}
