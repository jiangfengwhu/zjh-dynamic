import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
export function openApplicationWorkshop(appId: string, title: string, fork = false, prefill = true) {
  const context = applicationContext(bootstrap.defaultApplication);
  const target = fork ? `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` : appId;
  const workspaces = JSON.parse(context.storage.get("workspaces") || "[]") as Array<{ appId: string; title: string; originalAppId?: string }>;
  if (!workspaces.some(item => item.appId === target)) workspaces.push({ appId: target, title: fork ? `基于${title}` : title, ...(fork ? { originalAppId: appId } : {}) });
  context.storage.set("workspaces", JSON.stringify(workspaces));
  context.storage.set("workshopTarget", target);
  if (prefill) context.storage.set(`pendingPrompt.${target}`,  fork ? `基于「${title}」制作一个新的应用，我想` : `修改「${title}」，我想`);
  context.storage.set("openWorkshop", String(Date.now()));
  context.navigation.open();
}
