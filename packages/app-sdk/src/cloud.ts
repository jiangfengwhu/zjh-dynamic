import { CloudError, type AppAuth, type AppCloud, type CloudCollection, type CloudRequestOptions, type CloudWriteOptions } from "./cloud-types";

export type CloudTransport = (appId: string, scope: "private" | "public", collection: string, body: Record<string, unknown>, options?: CloudRequestOptions) => Promise<unknown>;
let transport: CloudTransport = async () => { throw new CloudError("UNAVAILABLE", "云服务尚未就绪"); };
let auth: AppAuth = { getUser: () => null, subscribe: () => () => {}, requireLogin: async () => null };
export function setApplicationCloudHandlers(handlers: { auth: AppAuth; request: CloudTransport }) { auth = handlers.auth; transport = handlers.request; }
const copyUser = () => { const user = auth.getUser(); return user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl } : null; };
export const applicationAuth: AppAuth = {
  getUser: copyUser,
  subscribe: listener => auth.subscribe(() => {
    try { listener(copyUser()); } catch { console.warn("应用用户资料订阅回调失败"); }
  }),
  requireLogin: async () => { const user = await auth.requireLogin(); return user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl } : null; },
};
function validateData(data: unknown, depth = 0): void {
  if (depth > 16) throw new CloudError("INVALID_ARGUMENT", "数据嵌套层级过深");
  if (data === null || typeof data === "string" || typeof data === "boolean" || typeof data === "number" && Number.isFinite(data)) return;
  if (Array.isArray(data)) { data.forEach(value => validateData(value, depth + 1)); return; }
  if (data && typeof data === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(data))) { Object.values(data).forEach(value => validateData(value, depth + 1)); return; }
  throw new CloudError("INVALID_ARGUMENT", "数据必须是 JSON 对象，不能包含 undefined、日期实例或函数");
}
export function applicationCloud(appId: string): AppCloud {
  const database = (scope: "private" | "public") => ({
    collection<T extends object>(name: string): CloudCollection<T> {
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(name)) throw new CloudError("INVALID_ARGUMENT", "集合名称无效");
      const read = <R>(body: Record<string, unknown>, options?: CloudRequestOptions) => transport(appId, scope, name, body, options) as Promise<R>;
      const write = async <R>(body: Record<string, unknown>, options?: CloudWriteOptions & { expectedVersion?: number }) => {
        if (body.operation !== "remove") {
          if (!body.data || typeof body.data !== "object" || Array.isArray(body.data)) throw new CloudError("INVALID_ARGUMENT", "数据必须是 JSON 对象");
          validateData(body.data);
        }
        // Never embed credentials or account identity in application-visible data.
        const requestId = options?.requestId ?? `${Date.now().toString(36)}-${Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("")}`;
        return read<R>({ ...body, requestId, ...(options?.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }) }, options);
      };
      return {
        create: (data, options) => write({ operation: "create", data }, options),
        get: (id, options) => read({ operation: "get", id }, options),
        list: (query, options) => read({ operation: "list", query }, options),
        update: (id, patch, options) => write({ operation: "update", id, data: patch }, options),
        remove: async (id, options) => { await write({ operation: "remove", id }, options); },
      };
    },
  });
  return { private: database("private"), public: database("public") };
}
