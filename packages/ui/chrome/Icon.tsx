import Svg, { Path } from "react-native-svg";

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
  | "moon"
  | "eye"
  | "trash";

/** 圆点用路径画，所有图标都只有 Path，颜色和粗细统一由外面传入。 */
function dot(x: number, y: number, r = 1.2): string {
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
}

const PATHS: Record<IconName, { d: string[]; solid?: string[] }> = {
  eye: { d: ["M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z", dot(12, 12, 2.5)] },
  trash: { d: ["M4 7h16", "M9 7V4h6v3", "M6 7l1 13h10l1-13", "M10 10v7", "M14 10v7"] },
  feed: { d: ["M9.5 6H20", "M9.5 12H20", "M9.5 18H20"], solid: [dot(4.5, 6, 1.4), dot(4.5, 12, 1.4), dot(4.5, 18, 1.4)] },
  workshop: {
    d: [
      "M11 3.5l1.9 5.3 5.3 1.9-5.3 1.9L11 17.9l-1.9-5.3-5.3-1.9 5.3-1.9z",
      "M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z",
    ],
  },
  mine: { d: [dot(12, 8, 3.6), "M5 20c.4-3.6 3.2-5.6 7-5.6s6.6 2 7 5.6"] },
  back: { d: ["M14.5 5.5L8 12l6.5 6.5"] },
  chevron: { d: ["M9.5 5.5L16 12l-6.5 6.5"] },
  check: { d: ["M5 12.5l4.6 4.6L19 7.5"] },
  close: { d: ["M6.5 6.5l11 11", "M17.5 6.5l-11 11"] },
  plus: { d: ["M12 5v14", "M5 12h14"] },
  send: { d: ["M12 19V5.5", "M6 11.5l6-6 6 6"] },
  stop: { d: ["M8 8h8v8H8z"], solid: ["M8 8h8v8H8z"] },
  edit: { d: ["M4.5 19.5l.8-3.8L16.4 4.6a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3L8.3 18.7z", "M14.5 6.5l3 3"] },
  info: { d: [dot(12, 12, 8.5), "M12 11v5"], solid: [dot(12, 7.9, 0.9)] },
  engine: {
    d: ["M7.5 7.5h9v9h-9z", "M10 3.5v4", "M14 3.5v4", "M10 16.5v4", "M14 16.5v4", "M3.5 10h4", "M3.5 14h4", "M16.5 10h4", "M16.5 14h4"],
  },
  box: { d: ["M4 6.5h16v3.5H4z", "M5.5 10v8.5h13V10", "M10 14h4"] },
  cloud: { d: ["M7.5 18.5a4 4 0 0 1-.6-7.95A5.6 5.6 0 0 1 17.7 10a4.2 4.2 0 0 1-.7 8.5z"] },
  clock: { d: [dot(12, 12, 8.5), "M12 7.5V12l3 2"] },
  more: { d: [], solid: [dot(5.5, 12, 1.5), dot(12, 12, 1.5), dot(18.5, 12, 1.5)] },
  alert: { d: ["M12 4l9 15.5H3z", "M12 10v4"], solid: [dot(12, 16.9, 0.9)] },
  restore: { d: ["M5 12a7 7 0 1 0 2.2-5.1", "M4.5 4.5v4h4"] },
  sun: {
    d: [dot(12, 12, 4), "M12 3v2", "M12 19v2", "M3 12h2", "M19 12h2", "M5.6 5.6L7 7", "M17 17l1.4 1.4", "M18.4 5.6L17 7", "M7 17l-1.4 1.4"],
  },
  moon: { d: ["M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"] },
};

export function Icon({
  name,
  size = 22,
  color,
  strokeWidth = 1.7,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const shape = PATHS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {shape.d.map((d, index) => (
        <Path key={`s${index}`} d={d} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {(shape.solid ?? []).map((d, index) => (
        <Path key={`f${index}`} d={d} fill={color} />
      ))}
    </Svg>
  );
}
