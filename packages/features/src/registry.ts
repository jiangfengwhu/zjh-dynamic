import type { ComponentType } from "react";
import type { AppAvatarProps } from "../../app-sdk/src/index";
import { peekApplication } from "../../app-sdk/src/runtime";
import { loadApplication, applicationLoaded } from "../../../apps/mobile/src/runtime/applications";
import { peekFeature, type FeatureComponent } from "./featureHost";
// Metadata only. Application pages, avatars and cards arrive in independent bundles.
export type BundleDefinition = {
  id: string;
  title: string;
  summary: string;
  accent: string;
  avatar?: ComponentType<AppAvatarProps>;
  /** Install/load an independent application; never import its business source. */
  load: () => unknown;
};

type ApplicationMetadata = { appId: string; appName: string; description: string; accent: string };
function definition(item: ApplicationMetadata): BundleDefinition {
  return { id: item.appId, title: item.appName, summary: item.description, accent: item.accent,
    get avatar() { return peekApplication(item.appId)?.avatar; },
    load: () => loadApplication(item.appId),
  };
}
export const bundles: BundleDefinition[] = [];
export function registerApplicationMetadata(item: ApplicationMetadata) {
  const prior = bundles.findIndex(bundle => bundle.id === item.appId);
  if (prior < 0) bundles.push(definition(item)); else bundles[prior] = definition(item);
}
let restoration: Promise<void> | undefined;
export function restoreApplications(): Promise<void> {
  if (!restoration) restoration = restoreInstalledApplications().catch(error => {
    restoration = undefined;
    throw error;
  });
  return restoration;
}
async function restoreInstalledApplications() {
  const { loadCatalog } = require("../../../apps/mobile/src/shell/catalog");
  const { readShellValue } = require("../../../apps/mobile/src/shell/shellStorage");
  for (const entry of await loadCatalog()) {
    const raw = await readShellValue(`application.pending.${entry.id}`) || await readShellValue(`application.install.${entry.id}`);
    if (!raw) continue;
    try {
      const item = JSON.parse(raw);
      if (item.appId !== entry.id || typeof item.appName !== "string") continue;
      const prior = bundles.findIndex(bundle => bundle.id === entry.id);
      if (prior < 0) bundles.push(definition(item)); else bundles[prior] = definition(item);
    } catch { /* Keep other installed applications available. */ }
  }
}

/** 取一位朋友的页面组件。第一次打开时执行 load；页面模块出错会抛出，由调用方显示。 */
export function cachedFeature(id: string): FeatureComponent | undefined {
  return applicationLoaded(id) ? peekFeature(id) : undefined;
}

export async function openFeature(id: string): Promise<FeatureComponent> {
  const cached = cachedFeature(id);
  if (cached) return cached;

  if (!bundles.some(item => item.id === id)) await restoreApplications();
  const definition = bundles.find((item) => item.id === id);
  if (!definition) throw new Error(`这个应用还没登记：${id}`);
  console.log("feature load", id);
  await definition.load();
  const component = peekFeature(id);
  if (!component) throw new Error(`这个应用的页面没有登记，缺少 registerFeature("${id}", …)`);
  return component;
}
