import { defineApp } from "@zijinhua/app-sdk";
import { IntroCard } from "./cards";
import { NotepadAvatar } from "./avatar";
export default defineApp({
  avatar: NotepadAvatar,
  main: () => require("./app").default,
  cards: { welcome: IntroCard },
  onInstall: ctx => ctx.feed.publish({ kind: "welcome", body: "你好！我是记事本。随手记录灵感，还支持 Markdown 格式预览。" }),
});
