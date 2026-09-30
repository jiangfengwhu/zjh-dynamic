import { defineApp } from "@zijinhua/app-sdk";
import { IntroCard, DoneCard, WorkingCard } from "./cards";
import { JollyPortrait } from "./ui";
export default defineApp({
  main: () => require("./Workshop").default,
  avatar: JollyPortrait,
  cards: { welcome: IntroCard, update: DoneCard, activity: WorkingCard },
  onInstall: ctx => ctx.feed.publish({ kind: "welcome", body: "大家好，我是 Jolly，心愿工坊的小管家。想做的小应用，跟我说一声就动手。" }),
});
