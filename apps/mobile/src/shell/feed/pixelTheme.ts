import { useTheme, type Theme } from "../../../../../packages/ui/theme";
import { useMemo } from "react";

/** Host-only migration: public SDK theme fields and application identity stay stable. */
export function pixelTheme(base: Theme): Theme {
  const dark = ["#141517", "#171322", "#19152C"].includes(base.canvas);
  return {
    ...base,
    canvas: dark ? "#19152C" : "#FFF9ED",
    surface: dark ? "#25203A" : "#FFFFFF",
    surfaceRaised: dark ? "#332B49" : "#F4ECFF",
    inset: dark ? "#223C39" : "#E9F8F0",
    line: dark ? "#42394D" : "#E9DFD7",
    lineStrong: dark ? "#665575" : "#D2BFCF",
    ink1: dark ? "#FFF6E8" : "#30233F",
    ink2: dark ? "#DED2EC" : "#54455D",
    ink3: dark ? "#BDB0CC" : "#796A7F",
    accent: "#FFD337",
    onAccent: "#30233F",
    accentText: dark ? "#FFD337" : "#885400",
    accentTint: dark ? "#493B20" : "#FFF0B5",
    accentSoft: dark ? "#E79C35" : "#F4B83D",
    red: "#F15B93",
    redText: dark ? "#FF8DB8" : "#B82F65",
    redTint: dark ? "#49263F" : "#FFE3EE",
    green: "#42D7A1",
    greenText: dark ? "#74E6B7" : "#087B57",
    greenTint: dark ? "#223C39" : "#DFF8ED",
    cyan: "#4E8DFF",
    cyanText: dark ? "#91B9FF" : "#315CC4",
    cyanTint: dark ? "#26324E" : "#E5EEFF",
    orchid: "#AB76F5",
    orchidText: dark ? "#C5A0FF" : "#7941B6",
    orchidTint: dark ? "#35254A" : "#F1E5FF",
  };
}

export function usePixelTheme() {
  const context = useTheme();
  return useMemo(
    () => ({ ...context, colors: pixelTheme(context.colors) }),
    [context]
  );
}
