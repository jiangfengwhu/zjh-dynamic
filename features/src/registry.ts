import type { ComponentType } from "react";
import { JollyPortrait } from "../../components/jolly";
import type { AppAvatarProps } from "../avatars/types";
import "../jolly/cards";
import { NotepadAvatar } from "../avatars/notepad";
import "../notepad/cards";
import { peekFeature, type FeatureComponent } from "./featureHost";
// 定制应用的页面放在 features/<id>/app.tsx，末尾调用 registerFeature(id, Component)；这里的 load 用 require 引入它。
// 每个应用也是动态里的一位好友。头像组件放在 features/avatars/<id>.tsx，动态页按 size 直接渲染。三套动态卡片放在 features/<id>/cards.tsx，由这里导入，壳启动时登记。
// 这里只登记会显示在动态里的信息。壳启动时不执行应用的页面，打开时才调用 load。
export type BundleDefinition = {
  id: string;
  title: string;
  summary: string;
  mark: string;
  accent: string;
  avatar?: ComponentType<AppAvatarProps>;
  /** 执行应用页面模块，模块末尾的 registerFeature 会把页面登记好。必须写成 () => require("../<id>/app")，让页面在打开时才执行。 */
  load: () => unknown;
};

export const bundles: BundleDefinition[] = [
  {
    id: "jolly",
    title: "Jolly",
    summary: "把一句心愿做成可以打开的小应用。",
    mark: "乔",
    accent: "#E0B785",
    avatar: JollyPortrait,
    load: () => require("../jolly/app"),
  },
  {
    id: "notepad",
    title: "记事本",
    summary: "记录灵感，支持 Markdown 预览。",
    mark: "记",
    accent: "#7A5BD0",
    avatar: NotepadAvatar,
    load: () => require("../notepad/app"),
  },
];

/** 取一位朋友的页面组件。第一次打开时执行 load；页面模块出错会抛出，由调用方显示。 */
export function openFeature(id: string): FeatureComponent {
  const existing = peekFeature(id);
  if (existing) return existing;
  const definition = bundles.find((item) => item.id === id);
  if (!definition) throw new Error(`这个应用还没登记：${id}`);
  console.log("feature load", id);
  definition.load();
  const component = peekFeature(id);
  if (!component) throw new Error(`这个应用的页面没有登记，缺少 registerFeature("${id}", …)`);
  return component;
}
