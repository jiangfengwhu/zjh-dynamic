import { normalizeShareParams } from "../../../../../packages/app-sdk/src/sharing";
import { fetchMarketDetail } from "../market";
import type { UserPostDraft } from "../../../../../packages/app-sdk/src/index";
import { currentAccountId, requireAccount } from "../account";
import { publishUserPost } from "./userPosts";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { htmlByteLength } from "./postDraft";

const pending = new Map<string, Promise<{ id: string }>>();
const retries = new Map<string, string>();
export function validatePostDraft(draft: UserPostDraft) {
  if (
    !draft ||
    typeof draft !== "object" ||
    (draft.body != null && typeof draft.body !== "string") ||
    (draft.html != null && typeof draft.html !== "string")
  )
    throw new Error("分享内容无效");
  if (
    Array.from(draft.body ?? "").length > 2000 ||
    htmlByteLength(draft.html ?? "") > 32768
  )
    throw new Error("正文最多 2000 字，HTML 最多 32 KB");
  if (draft.application) {
    if (typeof draft.application.appId !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(draft.application.appId)) throw new Error("应用标识无效");
    normalizeShareParams(draft.application.params);
  }
  if (!draft.body?.trim() && !draft.html?.trim() && !draft.application)
    throw new Error("请先添加分享内容");
}

/** The tap publishes directly. Pending duplicate taps share one request and identity. */
export async function shareApplicationPost(
  appId: string,
  draft: UserPostDraft
): Promise<{ id: string }> {
  validatePostDraft(draft);
  if (!(await requireAccount())) throw new Error("请登录后分享");
  const owner = await currentAccountId();
  if (!owner) throw new Error("请登录后分享");
  const key = JSON.stringify([
    owner,
    appId,
    draft.body ?? "",
    draft.html ?? "",
    draft.requestId ?? "",
    draft.application ?? null,
  ]);
  const existing = pending.get(key);
  if (existing) return existing;
  const requestId =
    draft.requestId ??
    retries.get(key) ??
    `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2)}-${Math.random().toString(36).slice(2)}`;
  retries.set(key, requestId);
  if (retries.size > 100) retries.delete(retries.keys().next().value!);
  const operation = (async () => {
    const item = draft.application ? await fetchMarketDetail(draft.application.appId, { immediate: true }) : undefined;
    if (await currentAccountId() !== owner) throw new Error("账号已改变，请重试");
    return publishUserPost(
    draft.body?.trim() ?? "",
    [],
    requestId,
    item && draft.application ? { appId: item.manifest.appId, releaseId: item.manifest.releaseId, params: normalizeShareParams(draft.application.params) } : undefined,
    draft.html?.trim()
      ? { format: "html", version: 1, html: draft.html }
      : undefined
  );
  })()
    .then((post) => {
      retries.delete(key);
      Toast.show({ type: "success", text1: "已发布动态" });
      return { id: post.id };
    })
    .catch((error) => {
      Toast.show({ type: "error", text1: "分享失败", text2: error.message });
      throw error;
    })
    .finally(() => pending.delete(key));
  pending.set(key, operation);
  return operation;
}
