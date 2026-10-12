import type { AppData, DataScope, FileActionResult, TextChunkOptions } from "./index";
import { readPackageValue, writePackageValue, removePackageValue, subscribePackageValue } from "../../ui/packageLink";
import { shell } from "../../platform/src/phone";
import { documentAction } from "./documents";
import type { OcrResult } from "./native-types";
import { nativeResult } from "./native-result";

export async function fileAction(method: string, payload: Record<string, unknown>): Promise<FileActionResult> {
  try {
    const result = await shell<{ ok: boolean; error?: string }>(method, payload);
    return nativeResult(result);
  } catch { return { ok: false, code: "ERROR", error: "文件操作失败，请重试" }; }
}

/** Commit an app-owned temporary file without deleting the previous contents. */
export async function commitApplicationFile(appId: string, temporary: string, path: string, signal?: AbortSignal) {
  const result = await documentAction(appId, "fileCommit", { temporary, path }, signal, "operationCancel");
  if (!result.ok) throw new Error(result.code === "CANCELLED" ? "CANCELLED" : "文件保存失败");
}

/** mkdir may race another write/download targeting the same parent. */
export async function ensureApplicationDirectory(directory: string) {
  const fs = require("react-native-blob-util").default.fs;
  if (await fs.exists(directory)) return;
  try { await fs.mkdir(directory); }
  catch (error) {
    if ((await fs.stat(directory).catch(() => undefined))?.type !== "directory") throw error;
  }
}

// Old APKs placed immutable package bytes beside business files. Keep those
// reserved filenames inaccessible without changing any user file paths.
const packageFile = (name: string) => /^[a-f0-9]{64}\.(?:bundle|tmp)$/.test(name);

/** The resolver binds the scope; applications never supply host account IDs or native paths. */
export function applicationData(appId: string, scope: DataScope, account: () => string, subscribeAccount: (listener: () => void) => () => void): AppData {
  const blob = () => require("react-native-blob-util").default;
  const namespace = () => scope === "account" ? `accounts/${account()}` : "";
  const root = (ns: string) => `${blob().fs.dirs.DocumentDir}/applications/${appId}${ns ? `/${ns}` : ""}`;
  const validPath = (path: string) => {
    if (!/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(path) || path.split("/").some(part => part === "." || part === "..") || scope === "device" && (path.split("/")[0] === "accounts" || packageFile(path.split("/")[0]))) throw new Error("应用文件路径无效");
    return path;
  };
  const key = (key: string) => {
    if (!key || key.length > 200 || scope === "device" && key.startsWith("accounts.")) throw new Error("应用存储键无效");
    return key;
  };
  const storageKey = (value: string) => `application.${appId}.${scope === "account" ? `accounts.${account()}.` : ""}${key(value)}`;
  const guard = (ns: string) => { if (ns !== namespace()) throw new Error("账号已切换，请重新读取当前账号数据"); };
  const pathFor = (path: string, ns = namespace()) => `${root(ns)}/${validPath(path)}`;
  const parent = (path: string) => ensureApplicationDirectory(path.slice(0, path.lastIndexOf("/")));
  const secure = (value: string, ns: string) => `com.zijinhua.applications.${appId}.${ns ? `${ns.replaceAll("/", ".")}.` : ""}${encodeURIComponent(key(value))}`;
  const transferOptions = (options?: { timeoutMs?: number; maxBytes?: number }) => {
    if (options?.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 1000 || options.timeoutMs > 180000)) throw new Error("超时须为 1–180 秒");
    if (options?.maxBytes !== undefined && (!Number.isSafeInteger(options.maxBytes) || options.maxBytes < 1 || options.maxBytes > 100 * 1024 * 1024)) throw new Error("文件上限须为 1 字节至 100 MB");
  };
  const scopedRequest = (ns: string, signal?: AbortSignal) => {
    const controller = new AbortController();
    const abort = () => controller.abort(); signal?.addEventListener("abort", abort);
    const removeAccount = scope === "account" ? subscribeAccount(() => { if (ns !== namespace()) abort(); }) : () => {};
    if (signal?.aborted) abort();
    return { signal: controller.signal, dispose: () => { signal?.removeEventListener("abort", abort); removeAccount(); } };
  };
  const transfer = async (method: string, path: string, options?: { name?: string; title?: string; mime?: string; signal?: AbortSignal; timeoutMs?: number; maxBytes?: number }): Promise<FileActionResult> => {
    transferOptions(options);
    const ns = namespace(); const target = pathFor(path, ns);
    const request = scopedRequest(ns, options?.signal);
    try {
      if (!await blob().fs.exists(target)) throw new Error("missing file");
      guard(ns);
      const { signal, ...input } = options ?? {};
      const result = await documentAction(appId, method, { path: target, ...input }, request.signal, "operationCancel"); guard(ns);
      return result.ok ? { ok: true } : { ok: false, code: result.code, error: result.error };
    } catch { return request.signal.aborted ? { ok: false, code: "CANCELLED", error: "已取消" } : { ok: false, code: "ERROR", error: "无法读取应用文件，请重试" }; }
    finally { request.dispose(); }
  };
  const fileMutation = async (method: string, path: string, target?: string, text?: string, options: import("./index").FileOperationOptions & { overwrite?: boolean } = {}): Promise<FileActionResult> => {
    transferOptions(options); const ns = namespace(), request = scopedRequest(ns, options.signal);
    try {
      const { signal, ...input } = options;
      const result = await documentAction(appId, method, { path: pathFor(path, ns), ...(target === undefined ? {} : { target: pathFor(target, ns) }), ...(text === undefined ? {} : { text }), ...input }, request.signal, "operationCancel"); guard(ns); return result;
    } catch { return request.signal.aborted ? { ok: false, code: "CANCELLED", error: "已取消" } : { ok: false, code: "ERROR", error: "文件操作失败，请重试" }; }
    finally { request.dispose(); }
  };
  async function* textChunks(path: string, options: TextChunkOptions = {}, maxBytes?: number): AsyncGenerator<string> {
    const chunkBytes = options.chunkBytes ?? 64 * 1024;
    if (!Number.isInteger(chunkBytes) || chunkBytes < 4096 || chunkBytes > 256 * 1024) throw new Error("分片大小须为 4–256 KiB");
    const ns = namespace(), target = pathFor(path, ns);
    const request = scopedRequest(ns, options.signal);
    let offset = 0;
    let identity: { size: number; modified: number; inode: string } | undefined;
    try {
      while (true) {
        guard(ns); request.signal.throwIfAborted();
        const result = await documentAction(appId, "fileReadTextChunk", { path: target, offset, chunkBytes, ...identity, ...(maxBytes === undefined ? {} : { maxBytes }) }, request.signal, "operationCancel");
        guard(ns); request.signal.throwIfAborted();
        if (!result.ok) throw new Error(result.code === "TOO_LARGE" ? "文本超过 6 MiB，请使用 readTextChunks 分片读取" : result.error);
        const { text, nextOffset, done, size, modified, inode } = result;
        if (typeof text !== "string" || !Number.isSafeInteger(nextOffset) || !Number.isSafeInteger(size) || typeof modified !== "number" || typeof inode !== "string" || typeof done !== "boolean") throw new Error("文件读取结果无效");
        const next = nextOffset as number, length = size as number;
        if (next < offset || next > length || next - offset > chunkBytes || (!done && next === offset) || done !== (next === length)) throw new Error("文件读取位置无效");
        identity = { size: length, modified, inode };
        offset = next;
        if (text) yield text;
        guard(ns); request.signal.throwIfAborted();
        if (done) return;
      }
    } finally { request.dispose(); }
  }
  return {
    storage: {
      get: value => readPackageValue(storageKey(value)),
      set: (value, data) => writePackageValue(storageKey(value), data),
      remove: value => removePackageValue(storageKey(value)),
      subscribe: (value, listener) => {
        let remove = subscribePackageValue(storageKey(value), listener);
        const changed = () => { remove(); remove = subscribePackageValue(storageKey(value), listener); listener(readPackageValue(storageKey(value))); };
        const removeAccount = scope === "account" ? subscribeAccount(changed) : () => {};
        return () => { remove(); removeAccount(); };
      },
    },
    secureStorage: {
      get: async value => { const ns = namespace(); const result = await require("react-native-keychain").getGenericPassword({ service: secure(value, ns) }); guard(ns); return result ? result.password : undefined; },
      set: async (value, data) => { const ns = namespace(); await require("react-native-keychain").setGenericPassword(appId, data, { service: secure(value, ns) }); guard(ns); },
      remove: async value => { const ns = namespace(); await require("react-native-keychain").resetGenericPassword({ service: secure(value, ns) }); guard(ns); },
    },
    files: {
      stat: async (path, options = {}) => {
        transferOptions(options); const ns = namespace(), request = scopedRequest(ns, options.signal);
        try { const { signal, ...input } = options; const result = await documentAction(appId, "fileStat", { path: pathFor(path, ns), ...input }, request.signal, "operationCancel"); guard(ns); if (!result.ok) throw new Error(result.error); return result as unknown as import("./index").AppFileStat; }
        finally { request.dispose(); }
      },
      listPage: async (directory = "", options = {}) => {
        transferOptions(options);
        if (options.limit !== undefined && (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 200) || options.cursor !== undefined && (options.cursor.length > 255 || options.cursor.includes("/") || options.cursor.includes("\\"))) throw new Error("目录分页参数无效");
        const ns = namespace(), request = scopedRequest(ns, options.signal);
        try {
          const { signal, ...input } = options;
          const target = directory ? pathFor(directory, ns) : root(ns);
          const result = await documentAction(appId, "fileListPage", { path: target, device: scope === "device", ...input }, request.signal, "operationCancel"); guard(ns);
          if (!result.ok) throw new Error(result.error);
          return { items: result.items as string[], nextCursor: result.nextCursor as string | null };
        } finally { request.dispose(); }
      },
      copy: (from, to, options) => fileMutation("fileCopy", from, to, undefined, options),
      move: (from, to, options) => fileMutation("fileMove", from, to, undefined, options),
      appendText: (path, text, options) => { if (typeof text !== "string" || text.length > 6 * 1024 * 1024) throw new Error("追加文字过大"); return fileMutation("fileAppendText", path, undefined, text, options); },
      recognizeText: async (path, options) => {
        const ns = namespace(), request = scopedRequest(ns, options?.signal);
        try { const result = await documentAction(appId, "documentRecognize", { path: pathFor(path, ns) }, request.signal); guard(ns); return result as OcrResult; }
        finally { request.dispose(); }
      },
      extractText: async (path, options = {}) => {
        if (options.maxChars !== undefined && (!Number.isInteger(options.maxChars) || options.maxChars < 1 || options.maxChars > 128000)) throw new Error("正文上限须为 1–128000 字符");
        const ns = namespace(), request = scopedRequest(ns, options.signal);
        try {
          const result = await documentAction(appId, "documentExtractText", { path: pathFor(path, ns), maxChars: options.maxChars ?? 100000 }, request.signal);
          guard(ns);
          if (result.ok && (typeof result.text !== "string" || typeof result.truncated !== "boolean" || !["pdf", "docx", "doc"].includes(result.format as string))) return { ok: false, code: "UNAVAILABLE", error: "文档读取结果无效" };
          return result as import("./index").DocumentTextResult;
        } finally { request.dispose(); }
      },
      print: async (path, options) => {
        const ns = namespace(); guard(ns);
        const result = await documentAction(appId, "documentPrint", { path: pathFor(path, ns), title: options?.title }); guard(ns);
        return result;
      },
      uri: path => `file://${pathFor(path)}`,
      readText: async (path, options) => {
        const chunks: string[] = [];
        for await (const chunk of textChunks(path, options, 6 * 1024 * 1024)) chunks.push(chunk);
        return chunks.join("");
      },
      readTextChunks: (path, options) => textChunks(path, options),
      readBase64: async path => {
        const ns = namespace(), target = pathFor(path, ns);
        const stat = await blob().fs.stat(target); guard(ns);
        if (Number(stat.size) > 6 * 1024 * 1024) throw new Error("读取文件不能超过 6 MB");
        const result: string = await blob().fs.readFile(target, "base64"); guard(ns);
        if (result.length > 8 * 1024 * 1024) throw new Error("读取文件不能超过 6 MB");
        return result;
      },
      writeText: async (path, data) => {
        const ns = namespace(), target = pathFor(path, ns), temporary = `${target}.write-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await parent(target); guard(ns);
        try { await blob().fs.writeFile(temporary, data, "utf8"); guard(ns); await commitApplicationFile(appId, temporary, target); guard(ns); }
        finally { await blob().fs.unlink(temporary).catch(() => {}); }
      },
      writeBase64: async (path, data) => {
        if (data.length > 8 * 1024 * 1024 || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new Error("Base64 数据无效或超过 6 MB");
        const ns = namespace(), target = pathFor(path, ns), temporary = `${target}.write-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await parent(target); guard(ns);
        try { await blob().fs.writeFile(temporary, data, "base64"); guard(ns); await commitApplicationFile(appId, temporary, target); guard(ns); }
        finally { await blob().fs.unlink(temporary).catch(() => {}); }
      },
      remove: async path => { const ns = namespace(); const target = pathFor(path, ns); if (await blob().fs.exists(target)) { guard(ns); await blob().fs.unlink(target); } guard(ns); },
      list: async (directory = "") => { const ns = namespace(); const target = directory ? pathFor(directory, ns) : root(ns); const result: string[] = await blob().fs.exists(target) ? await blob().fs.ls(target) : []; guard(ns); return scope === "device" && !directory ? result.filter(name => name !== "accounts" && !packageFile(name)) : result; },
      download: async (url, path, options = {}) => {
        if (!/^https:\/\//i.test(url)) throw new Error("下载地址必须使用 HTTPS");
        const timeout = options.timeoutMs ?? 60000;
        if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 180000) throw new Error("下载超时须为 1–180 秒");
        if (options.signal?.aborted) throw new Error("下载已取消");
        const ns = namespace(); const target = pathFor(path, ns); const temporary = `${target}.download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await parent(target); guard(ns);
        if (options.signal?.aborted) throw new Error("下载已取消");
        const task = blob().config({ path: temporary, followRedirect: false, timeout }).fetch("GET", url);
        let cancelled = false;
        const cancel = () => { if (cancelled) return; cancelled = true; try { task.cancel(); } catch {} };
        options.signal?.addEventListener("abort", cancel);
        const removeAccount = scope === "account" ? subscribeAccount(() => { if (ns !== namespace()) cancel(); }) : () => {};
        if (options.onProgress) task.progress({ interval: 250 }, (received: string, total: string) => {
          if (options.signal?.aborted || ns !== namespace()) return;
          try { options.onProgress?.(Number(received), Number(total) > 0 ? Number(total) : undefined); } catch {}
        });
        if (options.signal?.aborted) cancel();
        try {
          const result = await task;
          if (result.info().status < 200 || result.info().status >= 300) throw new Error("下载失败");
          if (options.signal?.aborted) throw new Error("下载已取消");
          guard(ns); await commitApplicationFile(appId, temporary, target, options.signal); guard(ns);
        } finally { options.signal?.removeEventListener("abort", cancel); removeAccount(); if (await blob().fs.exists(temporary)) await blob().fs.unlink(temporary); }
      },
      importFile: async (path, options = {}) => {
        transferOptions(options);
        const ns = namespace(); const target = pathFor(path, ns);
        const request = scopedRequest(ns, options.signal);
        try {
          const { signal, ...input } = options;
          const result = await documentAction(appId, "pick", { path: target, ...input }, request.signal, "operationCancel"); guard(ns);
          return result.ok ? { ok: true, path, name: typeof result.name === "string" ? result.name : path.split("/").pop()! } : { ok: false, code: result.code, error: result.error };
        } catch { return request.signal.aborted ? { ok: false, code: "CANCELLED", error: "已取消" } : { ok: false, code: "ERROR", error: "无法导入文件，请重试" }; }
        finally { request.dispose(); }
      },
      exportFile: (path, options) => transfer("exportFile", path, options),
      share: (path, options) => transfer("share", path, options),
      saveToGallery: async (path, options) => {
        const ext = path.split(".").pop()?.toLowerCase() ?? "";
        const mime = options?.mime ?? ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm" } as Record<string, string>)[ext];
        if (!mime || !["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm"].includes(mime)) throw new Error("相册仅支持 JPEG/PNG/WebP/GIF/MP4/WebM");
        const { Platform } = require("react-native");
        if (Number(Platform.Version) < 29) return transfer("exportFile", path, { ...options, mime });
        const ns = namespace();
        try { guard(ns); return await fileAction("saveToGallery", { appId, path: pathFor(path, ns), ...options, mime }); }
        catch { return { ok: false, code: "ERROR", error: "无法保存到相册" }; }
      },
    },
  };
}
