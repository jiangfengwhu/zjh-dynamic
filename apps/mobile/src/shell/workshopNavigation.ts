import { requireAccount, currentAccountId, cachedAccountId } from "./account";
import { shellNavigationRef } from "./navigationRef";

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
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId))
    throw new Error("作品身份无效");
  if (!shellNavigationRef.isReady()) return;
  shellNavigationRef.navigate("workshopProgress", { appId, title, ownerId });
  return appId;
}
