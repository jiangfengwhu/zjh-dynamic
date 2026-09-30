import { defineApp } from "@zijinhua/app-sdk";
import { IntroCard, UpdateCard } from "./cards";
import { PomodoroAvatar } from "./avatar";
export default defineApp({
  avatar: PomodoroAvatar,
  main: () => require("./app").default,
  cards: { welcome: IntroCard, update: UpdateCard },
  onInstall: ctx => ctx.feed.publish({ kind: "welcome", body: "你好，我是番茄钟。每次专注 25 分钟，种下一朵小花。需要专注时随时找我。" }),
});
