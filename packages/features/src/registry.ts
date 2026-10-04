import type { ComponentType } from "react";
import type { AppAvatarProps } from "../avatars/types";
import { peekApplication } from "../../app-sdk/src/runtime";
import { loadApplication, fetchApplicationCatalog, applicationLoaded } from "../../../apps/mobile/src/runtime/applications";
import { peekFeature, type FeatureComponent } from "./featureHost";
// Metadata only. Application pages, avatars and cards arrive in independent bundles.
export type BundleDefinition = {
  id: string;
  title: string;
  summary: string;
  mark: string;
  accent: string;
  avatar?: ComponentType<AppAvatarProps>;
  /** Install/load an independent application; never import its business source. */
  load: () => unknown;
};

const index = require("../../../apps/mobile/src/runtime/application-index.json") as Array<{ appId: string; title: string; summary: string; mark: string; accent: string }>;
function definition(item: (typeof index)[number]): BundleDefinition {
  return { id: item.appId, title: item.title, summary: item.summary, mark: item.mark, accent: item.accent,
    get avatar() { return peekApplication(item.appId)?.avatar; },
    load: () => loadApplication(item.appId),
  };
}
export const bundles: BundleDefinition[] = index.filter(item => item.appId !== "jolly").map(definition);
export function registerApplicationMetadata(item: (typeof index)[number]) {
  if (item.appId === "jolly") return;
  const prior = bundles.findIndex(bundle => bundle.id === item.appId);
  if (prior < 0) bundles.push(definition(item)); else bundles[prior] = definition(item);
}
export async function restoreApplications() {
  const { loadCatalog } = require("../../../apps/mobile/src/shell/catalog");
  const { readShellValue } = require("../../../apps/mobile/src/shell/shellStorage");
  for (const entry of await loadCatalog()) {
    const raw = await readShellValue(`application.pending.${entry.id}`) || await readShellValue(`application.install.${entry.id}`);
    if (!raw) continue;
    try {
      const item = JSON.parse(raw);
      if (item.appId !== entry.id || typeof item.title !== "string") continue;
      const prior = bundles.findIndex(bundle => bundle.id === entry.id);
      if (prior < 0) bundles.push(definition(item)); else bundles[prior] = definition(item);
    } catch { /* Keep other installed applications available. */ }
  }
}

export async function refreshApplications() {
  const { edgeUrl } = require("../../../apps/mobile/src/shell/evolveHost");
  try {
    const response = await fetchApplicationCatalog(`${edgeUrl}/v1/applications`);
    if (!response.ok) throw new Error("无法读取应用目录");
    const payload = await response.json() as { applications: typeof index };
    for (const item of payload.applications) {
      if (item.appId === "jolly") continue;
      if (!/^[a-z][a-z0-9-]{0,63}$/.test(item.appId) || typeof item.title !== "string") continue;
      const prior = bundles.findIndex(bundle => bundle.id === item.appId);
      if (prior < 0) bundles.push(definition(item)); else bundles[prior] = definition(item);
    }
  } catch (error) { console.log("application catalog offline", String(error)); }
}

/** 取一位朋友的页面组件。第一次打开时执行 load；页面模块出错会抛出，由调用方显示。 */
export function cachedFeature(id: string): FeatureComponent | undefined {
  return applicationLoaded(id) ? peekFeature(id) : undefined;
}

export async function openFeature(id: string): Promise<FeatureComponent> {

  const definition = bundles.find((item) => item.id === id);
  if (!definition) throw new Error(`这个应用还没登记：${id}`);
  console.log("feature load", id);
  await definition.load();
  const component = peekFeature(id);
  if (!component) throw new Error(`这个应用的页面没有登记，缺少 registerFeature("${id}", …)`);
  return component;
}
