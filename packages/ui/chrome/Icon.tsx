import { PixelIcon, type PixelSymbol } from "./PixelIcon";

export type IconName =
  | "feed"
  | "workshop"
  | "mine"
  | "back"
  | "chevron"
  | "check"
  | "close"
  | "plus"
  | "send"
  | "stop"
  | "edit"
  | "info"
  | "engine"
  | "box"
  | "cloud"
  | "clock"
  | "more"
  | "alert"
  | "restore"
  | "sun"
  | "moon";

const names: Record<IconName, PixelSymbol> = {
  feed: "feed",
  workshop: "spark",
  mine: "mine",
  back: "back",
  chevron: "arrow",
  check: "check",
  close: "close",
  plus: "plus",
  send: "send",
  stop: "stop",
  edit: "edit",
  info: "info",
  engine: "engine",
  box: "box",
  cloud: "cloud",
  clock: "clock",
  more: "more",
  alert: "alert",
  restore: "refresh",
  sun: "sun",
  moon: "moon",
};

export function Icon({
  name,
  size = 22,
  color,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return <PixelIcon name={names[name]} size={size} color={color} />;
}
