import { useTheme, type Theme } from "../../../../../packages/ui/theme";
import { useMemo } from "react";

/** Host-only migration: public SDK theme fields and application identity stay stable. */
export function pixelTheme(base: Theme): Theme {
  const dark = base.canvas === "#141517" || base.canvas === "#171322";
  return {
    ...base,
    canvas: dark ? "#171322" : "#F1EDF8",
    surface: dark ? "#231D32" : "#FFFCF5",
    surfaceRaised: dark ? "#302641" : "#E6DDF4",
    inset: dark ? "#110E1A" : "#E6DDF4",
    line: dark ? "#433653" : "#D5C8E5",
    lineStrong: dark ? "#806995" : "#8C729F",
    ink1: dark ? "#FFF4DE" : "#2E2141",
    ink2: dark ? "#D8CCE5" : "#514160",
    ink3: dark ? "#B8A6C9" : "#705D80",
    accent: "#F2C665",
    onAccent: "#30213D",
    accentText: dark ? "#F2C665" : "#765000",
    accentTint: dark ? "#3C2F25" : "#FFF0CC",
    accentSoft: dark ? "#65503A" : "#EBD094",
    orchidText: dark ? "#D3B9F5" : "#69458A",
  };
}

export function usePixelTheme() {
  const context = useTheme();
  return useMemo(
    () => ({ ...context, colors: pixelTheme(context.colors) }),
    [context]
  );
}
