import BlobUtil from "react-native-blob-util";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { CloudError, type CloudErrorCode, type CloudFiles, type CloudFile } from "../../../../packages/app-sdk/src/cloud-types";
import { accountCloudFile, accountFetch, cachedAccountId, requireAccount, subscribeAccountIdentity } from "../shell/account";
import { edgeUrl } from "../shell/evolveHost";

const id = (value: string) => { if (!/^[a-f0-9-]{36}$/.test(value)) throw new CloudError("INVALID_ARGUMENT", "云文件 ID 无效"); return value; };
const uuid = () => { const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; const h = Array.from(b, n => n.toString(16).padStart(2, "0")).join(""); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
const known = new Set<CloudErrorCode>(["INVALID_ARGUMENT", "ACCOUNT_CHANGED", "UNAUTHENTICATED", "CANCELLED", "NOT_FOUND", "CONFLICT", "QUOTA_EXCEEDED", "RATE_LIMITED", "FORBIDDEN", "UNAVAILABLE"]);
const failure = (cause: unknown): never => { if (cause instanceof CloudError) throw cause; const code = cause instanceof Error && known.has(cause.message as CloudErrorCode) ? cause.message as CloudErrorCode : "NETWORK"; throw new CloudError(code, "云文件操作未完成，请重试"); };
export function applicationCloudFiles(appId: string): CloudFiles {
  const route = (fileId: string) => `/v1/app-files/${appId}/${id(fileId)}`;
  const metadata = async (fileId: string, method: string, signal?: AbortSignal) => {
    if (signal?.aborted) throw new CloudError("CANCELLED", "操作已取消");
    if (!await requireAccount(false)) throw new CloudError("UNAUTHENTICATED", "请先登录");
    const controller = new AbortController(); let changed = false;
    const stop = subscribeAccountIdentity(() => { changed = true; controller.abort(); });
    const cancel = () => controller.abort(); signal?.addEventListener("abort", cancel);
    if (signal?.aborted) controller.abort();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await accountFetch(edgeUrl + route(fileId), { method, signal: controller.signal }, false);
      const value = await response.json();
      if (changed) throw new CloudError("ACCOUNT_CHANGED", "账号已切换");
      if (!response.ok) throw new CloudError(known.has(value.code) ? value.code : "UNAVAILABLE", value.message || "云文件操作失败");
      return value.result as CloudFile | null;
    } catch (cause) {
      if (changed) throw new CloudError("ACCOUNT_CHANGED", "账号已切换");
      if (signal?.aborted) throw new CloudError("CANCELLED", "操作已取消");
      return failure(cause);
    } finally { stop(); clearTimeout(timer); signal?.removeEventListener("abort", cancel); }
  };
  return {
    upload: async (path, options) => {
      try {
        if (!await requireAccount(false)) throw new Error("UNAUTHENTICATED");
        const owner = cachedAccountId();
        const source = applicationContext(appId).scope(options.localScope ?? "device").files.uri(path).replace(/^file:\/\//, "");
        const stat = await BlobUtil.fs.stat(source);
        if (cachedAccountId() !== owner) throw new Error("ACCOUNT_CHANGED");
        if (Number(stat.size) < 1 || Number(stat.size) > 10 * 1024 * 1024) throw new Error("INVALID_ARGUMENT");
        return await accountCloudFile(route(options.requestId ?? uuid()), source, true, { ...options, visibility: options.visibility ?? "private" }) as CloudFile;
      } catch (cause) { return failure(cause); }
    },
    get: (fileId, options) => metadata(fileId, "GET", options?.signal),
    remove: async (fileId, options) => { await metadata(fileId, "DELETE", options?.signal); },
    download: async (fileId, path, options) => {
      let temporary: string | undefined;
      try {
        if (!await requireAccount(false)) throw new Error("UNAUTHENTICATED");
        const owner = cachedAccountId();
        const target = applicationContext(appId).scope(options?.localScope ?? "device").files.uri(path).replace(/^file:\/\//, "");
        const directory = target.slice(0, target.lastIndexOf("/"));
        if (!await BlobUtil.fs.exists(directory)) await BlobUtil.fs.mkdir(directory);
        if (cachedAccountId() !== owner) throw new Error("ACCOUNT_CHANGED");
        temporary = `${target}.${uuid()}.part`;
        await accountCloudFile(route(fileId) + "/content", temporary, false, options ?? {});
        if (cachedAccountId() !== owner) throw new Error("ACCOUNT_CHANGED");
        if (options?.signal?.aborted) throw new Error("CANCELLED");
        if (await BlobUtil.fs.exists(target)) await BlobUtil.fs.unlink(target);
        if (cachedAccountId() !== owner) throw new Error("ACCOUNT_CHANGED");
        await BlobUtil.fs.mv(temporary, target); temporary = undefined;
        if (cachedAccountId() !== owner) throw new Error("ACCOUNT_CHANGED");
      } catch (cause) { failure(cause); }
      finally { if (temporary) await BlobUtil.fs.unlink(temporary).catch(() => {}); }
    },
  };
}
