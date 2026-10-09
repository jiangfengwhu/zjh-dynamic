import { CloudError, type CloudErrorCode } from "../../../../packages/app-sdk/src/cloud-types";
import { setApplicationCloudHandlers, type CloudTransport } from "../../../../packages/app-sdk/src/cloud";
import { accountFetch, cachedApplicationUser, requireAccount, subscribeApplicationUser, subscribeAccountIdentity } from "../shell/account";
import { applicationCloudFiles } from "./applicationCloudFiles";
import { applicationRooms, setCloudActivity } from "./applicationRooms";
import { edgeUrl } from "../shell/evolveHost";

const codes = new Set<CloudErrorCode>(["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "INVALID_ARGUMENT", "RATE_LIMITED", "QUOTA_EXCEEDED", "NETWORK", "CANCELLED", "ACCOUNT_CHANGED", "UNAVAILABLE"]);
const request: CloudTransport = async (appId, scope, collection, body, options, roomId) => {
  if (options?.signal?.aborted) throw new CloudError("CANCELLED", "操作已取消");
  if (!await requireAccount(false) || !cachedApplicationUser()) throw new CloudError("UNAUTHENTICATED", "请先登录");
  const controller = new AbortController();
  let accountChanged = false;
  let timedOut = false;
  const unsubscribe = subscribeAccountIdentity(() => { accountChanged = true; controller.abort(); });
  const cancel = () => controller.abort();
  options?.signal?.addEventListener("abort", cancel);
  if (options?.signal?.aborted) controller.abort();
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
  try {
    const response = await accountFetch(scope === "room" ? `${edgeUrl}/v1/app-rooms/${appId}/${roomId}/data/${collection}` : `${edgeUrl}/v1/app-data/${appId}/${scope}/${collection}`, {
      method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }, false);
    if (response.status === 401) throw new CloudError("UNAUTHENTICATED", "登录已过期，请重新登录");
    const result = await response.json() as { result?: unknown; code?: CloudErrorCode; message?: string };
    if (accountChanged) throw new CloudError("ACCOUNT_CHANGED", "账号已切换，请重新加载");
    if (!response.ok) throw new CloudError(result.code && codes.has(result.code) ? result.code : "UNAVAILABLE", result.message || "云服务暂不可用");
    return result.result;
  } catch (error) {
    if (error instanceof CloudError) throw error;
    if (accountChanged) throw new CloudError("ACCOUNT_CHANGED", "账号已切换，请重新加载");
    if (options?.signal?.aborted) throw new CloudError("CANCELLED", "操作已取消");
    if (timedOut) throw new CloudError("UNAVAILABLE", "请求超时，请稍后重试");
    if (!cachedApplicationUser()) throw new CloudError("UNAUTHENTICATED", "请先登录");
    throw new CloudError("NETWORK", "云数据请求失败，请检查网络");
  } finally {
    clearTimeout(timer); unsubscribe(); options?.signal?.removeEventListener("abort", cancel);
  }
};
export function installApplicationCloud() {
  setApplicationCloudHandlers({
    auth: {
      getUser: cachedApplicationUser,
      subscribe: subscribeApplicationUser,
      requireLogin: async () => await requireAccount() ? cachedApplicationUser() : null,
    },
    request, files: applicationCloudFiles, rooms: applicationRooms, activity: setCloudActivity,
  });
}
