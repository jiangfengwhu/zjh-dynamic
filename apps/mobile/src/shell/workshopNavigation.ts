import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { requireAccount, currentAccountId, cachedAccountId } from "./account";
import { shellNavigationRef } from "./navigation";

/** Progress belongs to the host. Preserve old callers while retiring plugin loading. */
export async function openApplicationWorkshop(
  appId: string,
  title: string,
  _fork = false,
  _prefill = false,
  _originalReleaseId?: string,
  _feedback?: unknown,
  expectedOwnerId?: string
) {
  const ownerId =
    cachedAccountId() ||
    ((await requireAccount()) ? await currentAccountId() : undefined);
  if (!ownerId) return;
  if (expectedOwnerId && expectedOwnerId !== ownerId)
    throw new Error("账号已改变，请重新打开作品");
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId) || appId === "jolly")
    throw new Error("作品身份无效");
  if (!shellNavigationRef.isReady()) return;
  shellNavigationRef.navigate("workshopProgress", { appId, title, ownerId });
  // Keep the legacy task-selection key; route rendering no longer waits for storage or a plugin.
  requestAnimationFrame(() => {
    if (applicationContext("jolly").storage.get("__accountScope") === ownerId)
      applicationContext("jolly").storage.set("workshopTarget", appId);
  });
  return appId;
}
