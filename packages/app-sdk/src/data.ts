import type { AppData, DataScope, FileActionResult } from "./index";
import { readPackageValue, writePackageValue, removePackageValue, subscribePackageValue } from "../../ui/packageLink";
import { shell } from "../../platform/src/phone";
import { documentAction } from "./documents";
import type { OcrResult, PdfResult } from "./native-types";

export async function fileAction(method: string, payload: Record<string, unknown>): Promise<FileActionResult> {
  try {
    const result = await shell<{ ok: boolean; error?: string }>(method, payload);
    return result.ok ? { ok: true } : { ok: false, code: result.error === "cancel" ? "CANCELLED" : "ERROR", error: result.error === "cancel" ? "已取消" : "文件操作失败，请重试" };
  } catch { return { ok: false, code: "ERROR", error: "文件操作失败，请重试" }; }
}

/** The resolver binds the scope; applications never supply host account IDs or native paths. */
export function applicationData(appId: string, scope: DataScope, account: () => string, subscribeAccount: (listener: () => void) => () => void): AppData {
  const blob = () => require("react-native-blob-util").default;
  const namespace = () => scope === "account" ? `accounts/${account()}` : "";
  const root = (ns: string) => `${blob().fs.dirs.DocumentDir}/applications/${appId}${ns ? `/${ns}` : ""}`;
  const validPath = (path: string) => {
    if (!/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*$/.test(path) || path.split("/").some(part => part === "." || part === "..") || scope === "device" && path.split("/")[0] === "accounts") throw new Error("应用文件路径无效");
    return path;
  };
  const key = (key: string) => {
    if (!key || key.length > 200 || scope === "device" && key.startsWith("accounts.")) throw new Error("应用存储键无效");
    return key;
  };
  const storageKey = (value: string) => `application.${appId}.${scope === "account" ? `accounts.${account()}.` : ""}${key(value)}`;
  const guard = (ns: string) => { if (ns !== namespace()) throw new Error("账号已切换，请重新读取当前账号数据"); };
  const pathFor = (path: string, ns = namespace()) => `${root(ns)}/${validPath(path)}`;
  const parent = async (path: string) => { const directory = path.slice(0, path.lastIndexOf("/")); if (!await blob().fs.exists(directory)) await blob().fs.mkdir(directory); };
  const secure = (value: string, ns: string) => `com.zijinhua.applications.${appId}.${ns ? `${ns.replaceAll("/", ".")}.` : ""}${encodeURIComponent(key(value))}`;
  const transfer = async (method: string, path: string, options?: { name?: string; title?: string; mime?: string }): Promise<FileActionResult> => {
    const ns = namespace(); const target = pathFor(path, ns);
    try {
      if (!await blob().fs.exists(target)) throw new Error("missing file");
      guard(ns);
      return await fileAction(method, { path: target, ...options });
    } catch { return { ok: false, code: "ERROR", error: "无法读取应用文件，请重试" }; }
  };
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
      recognizeText: async (path, options) => {
        const ns = namespace(); guard(ns);
        const result = await documentAction(appId, "documentRecognize", { path: pathFor(path, ns) }, options?.signal); guard(ns);
        return result as OcrResult;
      },
      createPdf: async (path, options) => {
        if (!path.toLowerCase().endsWith(".pdf") || !options.html.trim() || options.html.length > 2 * 1024 * 1024 || options.marginMm !== undefined && (!Number.isFinite(options.marginMm) || options.marginMm < 0 || options.marginMm > 40)) throw new Error("PDF 参数无效");
        const ns = namespace(), { signal, ...input } = options; guard(ns);
        const result = await documentAction(appId, "documentPdf", { ...input, path: pathFor(path, ns) }, signal); guard(ns);
        return (result.ok ? { ...result, path } : result) as PdfResult;
      },
      print: async (path, options) => {
        const ns = namespace(); guard(ns);
        const result = await documentAction(appId, "documentPrint", { path: pathFor(path, ns), title: options?.title }); guard(ns);
        return result;
      },
      uri: path => `file://${pathFor(path)}`,
      readText: async path => { const ns = namespace(); const result = await blob().fs.readFile(pathFor(path, ns), "utf8"); guard(ns); return result; },
      readBase64: async path => {
        const ns = namespace(), target = pathFor(path, ns);
        const stat = await blob().fs.stat(target); guard(ns);
        if (Number(stat.size) > 6 * 1024 * 1024) throw new Error("读取文件不能超过 6 MB");
        const result: string = await blob().fs.readFile(target, "base64"); guard(ns);
        if (result.length > 8 * 1024 * 1024) throw new Error("读取文件不能超过 6 MB");
        return result;
      },
      writeText: async (path, data) => { const ns = namespace(); const target = pathFor(path, ns); await parent(target); guard(ns); await blob().fs.writeFile(target, data, "utf8"); guard(ns); },
      writeBase64: async (path, data) => {
        if (data.length > 8 * 1024 * 1024 || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new Error("Base64 数据无效或超过 6 MB");
        const ns = namespace(), target = pathFor(path, ns), temporary = `${target}.write-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        await parent(target); guard(ns);
        try { await blob().fs.writeFile(temporary, data, "base64"); guard(ns); await blob().fs.mv(temporary, target); guard(ns); }
        finally { await blob().fs.unlink(temporary).catch(() => {}); }
      },
      remove: async path => { const ns = namespace(); const target = pathFor(path, ns); if (await blob().fs.exists(target)) { guard(ns); await blob().fs.unlink(target); } guard(ns); },
      list: async (directory = "") => { const ns = namespace(); const target = directory ? pathFor(directory, ns) : root(ns); const result: string[] = await blob().fs.exists(target) ? await blob().fs.ls(target) : []; guard(ns); return scope === "device" && !directory ? result.filter(name => name !== "accounts") : result; },
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
          guard(ns); await blob().fs.mv(temporary, target); guard(ns);
        } finally { options.signal?.removeEventListener("abort", cancel); removeAccount(); if (await blob().fs.exists(temporary)) await blob().fs.unlink(temporary); }
      },
      importFile: async (path, options) => {
        const ns = namespace(); const target = pathFor(path, ns); let temporary: string | undefined;
        const staging = `${target}.import-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        try {
          const picked = await shell<{ ok: boolean; path?: string; name?: string; error?: string }>("pick", { kind: "file", mime: options?.mime });
          if (!picked.ok) return { ok: false, code: picked.error === "cancel" ? "CANCELLED" : "ERROR", error: picked.error === "cancel" ? "已取消" : "无法导入文件" };
          temporary = picked.path;
          if (!temporary) throw new Error("missing selection");
          guard(ns); await parent(target); guard(ns); await blob().fs.cp(temporary, staging); guard(ns); await blob().fs.mv(staging, target); guard(ns);
          return { ok: true, path, name: picked.name ?? path.split("/").pop()! };
        } catch { return { ok: false, code: "ERROR", error: "无法导入文件，请重试" }; }
        finally {
          if (temporary) await blob().fs.unlink(temporary).catch(() => {});
          await blob().fs.unlink(staging).catch(() => {});
        }
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
