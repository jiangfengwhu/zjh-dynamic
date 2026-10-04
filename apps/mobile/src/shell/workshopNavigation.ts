import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { requireAccount, currentAccountId } from "./account";
import { readShellValue } from "./shellStorage";
import {
  runningApplication,
  fetchApplicationCatalog,
  preparePublicApplication,
  applicationNeedsReload,
  type ApplicationManifest,
} from "../runtime/applications";
import { edgeUrl } from "./evolveHost";
import NativePluginHost from "../NativePluginHost";
import { writeShellValue } from "./shellStorage";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
import { openCreationComposer } from "./creationComposer";
export async function openCreationRequest(
  appId: string,
  prompt?: string,
  navigate = true,
  expectedOwnerId?: string
) {
  if (navigate) {
    const manifest = runningApplication(appId);
    openCreationComposer(appId === bootstrap.defaultApplication ? undefined : { appId, title: manifest?.title || appId, releaseId: manifest?.releaseId, ownerId: expectedOwnerId, prompt });
    return;
  }
  if (!(await requireAccount())) return;
  if (expectedOwnerId && await currentAccountId() !== expectedOwnerId)
    throw new Error("账号已改变，请重新提交");
  const context = applicationContext(bootstrap.defaultApplication);
  if (appId === bootstrap.defaultApplication) {
    const target = `app-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    context.storage.set("workshopTarget", target);
    if (prompt) context.storage.set(`pendingPrompt.${target}`, prompt);
    context.storage.set("openWorkshop", String(Date.now()));
    if (navigate) context.navigation.open();
    return target;
  }
  const owner = await currentAccountId();
  const owned =
    (await readShellValue(`shell.jules.apps.${appId}.owner`)) === owner;
  const manifest = runningApplication(appId);
  if (!manifest || (await currentAccountId()) !== owner) return;
  await openApplicationWorkshop(
    appId,
    manifest.title,
    !owned,
    !owned,
    manifest.releaseId
  );
  if (prompt)
    context.storage.set(
      `pendingPrompt.${context.storage.get("workshopTarget")}`,
      prompt
    );
}
export type ApplicationFeedback = {
  appId: string;
  releaseId: string;
  title: string;
  body: string;
  images: string[];
};
export async function openApplicationWorkshop(
  appId: string,
  title: string,
  fork = false,
  prefill = true,
  originalReleaseId?: string,
  feedback?: ApplicationFeedback,
  expectedOwnerId?: string
) {
  if (!(await requireAccount())) return;
  const owner = await currentAccountId();
  if (!owner) return;
  if (expectedOwnerId && owner !== expectedOwnerId)
    throw new Error("账号已改变，请重新打开反馈页");
  let companion: ApplicationManifest | undefined;
  if (feedback) {
    const response = await fetchApplicationCatalog(
      `${edgeUrl}/v1/applications/${bootstrap.defaultApplication}/public`
    );
    if (!response.ok) throw new Error("暂时无法准备工坊，请稍后重试");
    const published = (await response.json()) as ApplicationManifest;
    if (
      runningApplication(bootstrap.defaultApplication)?.releaseId !==
      published.releaseId
    ) {
      if (
        (await readShellValue(
          `application.failed.${bootstrap.defaultApplication}`
        )) === published.releaseId
      )
        throw new Error(
          "工坊新版曾加载失败，请等待修复后的版本；反馈草稿已保留"
        );
      await preparePublicApplication(published);
      companion = published;
    }
    if ((await currentAccountId()) !== owner)
      throw new Error("账号已改变，请重新打开反馈页");
  }
  if (fork && !/^[a-f0-9]{64}$/.test(originalReleaseId ?? ""))
    throw new Error("请刷新市场后选择原作版本");
  const context = applicationContext(bootstrap.defaultApplication);
  const target = fork
    ? `app-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 10)}`
    : appId;
  const workspaces = JSON.parse(
    context.storage.get("workspaces") || "[]"
  ) as Array<{
    appId: string;
    title: string;
    originalAppId?: string;
    originalReleaseId?: string;
  }>;
  if (!workspaces.some((item) => item.appId === target))
    workspaces.push({
      appId: target,
      title: fork ? `基于${title}` : title,
      ...(fork ? { originalAppId: appId, originalReleaseId } : {}),
    });
  context.storage.set("workspaces", JSON.stringify(workspaces));
  context.storage.set("workshopTarget", target);
  if (feedback)
    context.storage.set(`pendingFeedback.${target}`, JSON.stringify(feedback));
  if (prefill)
    context.storage.set(
      `pendingPrompt.${target}`,
      fork ? `基于「${title}」制作一个新的应用，我想` : `修改「${title}」，我想`
    );
  if (companion)
    writeShellValue(
      `application.pending.${bootstrap.defaultApplication}`,
      JSON.stringify(companion)
    );
  if (companion && applicationNeedsReload(companion)) {
    writeShellValue(
      "application.openAfterReload",
      JSON.stringify({ appId: bootstrap.defaultApplication, ownerId: owner })
    );
    writeShellValue(
      "application.workshopAfterReload",
      JSON.stringify({ target, ownerId: owner })
    );
    try {
      await NativePluginHost.call("shell", "reloadApplications", "{}");
    } catch (error) {
      writeShellValue("application.openAfterReload", "");
      writeShellValue("application.workshopAfterReload", "");
      throw error;
    }
  } else {
    context.storage.set("openWorkshop", String(Date.now()));
    context.navigation.open();
  }
  return target;
}
