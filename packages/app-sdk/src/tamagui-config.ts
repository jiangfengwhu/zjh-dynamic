import { createFont, createTokens, createTamagui } from "tamagui";
import type { AnimationDriver, InferTamaguiConfig } from "@tamagui/core";
import { createAnimations } from "@tamagui/animations-react-native";

/** Host-owned configuration; applications use the shared Tamagui components directly. */
type Palette = {
  canvas: string; surface: string; surfaceRaised: string; field: string;
  ink1: string; ink2: string; ink3: string; line: string; lineStrong: string;
  accent: string; onAccent: string; accentText: string; accentTint: string;
  hover: string; redText: string; greenText: string; sans: string; mono: string;
};
export type ApplicationThemeName = "light_pixel" | "dark_pixel" | "light_soft" | "dark_soft";

const fontScale = {
  size: { 1: 11, 2: 12, 3: 14, 4: 15, 5: 17, 6: 21, 7: 25, 8: 30, 9: 36, 10: 44, true: 15 },
  lineHeight: { 1: 16, 2: 18, 3: 21, 4: 23, 5: 25, 6: 29, 7: 34, 8: 40, 9: 47, 10: 56, true: 23 },
  weight: { 1: "400", 4: "400", 6: "600", 8: "700", true: "400" },
  letterSpacing: { 1: 0, true: 0 },
} as const;
const tokenDefinitions = {
  color: { transparent: "transparent" },
  size: { 0: 0, 1: 24, 2: 32, 3: 36, 4: 44, 5: 52, 6: 60, 7: 72, 8: 84, 9: 96, 10: 112, true: 44 },
  space: { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 9: 36, 10: 40, true: 16 },
  radius: { 0: 0, 1: 4, 2: 8, 3: 10, 4: 12, 5: 14, 6: 18, 7: 22, 8: 26, 9: 30, 10: 34, true: 12 },
  zIndex: { 0: 0, 1: 10, 2: 100, 3: 1000, 4: 10000 },
};
type AnimationPresets = Record<"fast" | "medium" | "slow", { type: "timing"; duration: number }>;
const animations: AnimationDriver<Record<"fast" | "medium" | "slow", { type: "timing"; duration: number }>> = createAnimations({
  fast: { type: "timing", duration: 90 }, medium: { type: "timing", duration: 180 }, slow: { type: "timing", duration: 300 },
});

function palette(p: Palette) {
  return {
    background: p.canvas, backgroundHover: p.hover, backgroundPress: p.accentTint, backgroundFocus: p.field,
    backgroundStrong: p.surfaceRaised, backgroundTransparent: "transparent",
    color: p.ink1, colorHover: p.ink1, colorPress: p.ink1, colorFocus: p.ink1,
    colorTransparent: "transparent", placeholderColor: p.ink3,
    borderColor: p.line, borderColorHover: p.lineStrong, borderColorPress: p.accent,
    borderColorFocus: p.accent, outlineColor: p.accent, shadowColor: "#00000066",
    surface: p.surface, field: p.field, muted: p.ink3, secondary: p.ink2,
    accent: p.accent, onAccent: p.onAccent, accentText: p.accentText,
    danger: p.redText, success: p.greenText,
    body: p.sans, heading: p.sans, mono: p.mono,
  };
}

export type ApplicationTamaguiConfig = {
  tokens: ReturnType<typeof createTokens<typeof tokenDefinitions>>;
  themes: Record<ApplicationThemeName | `${ApplicationThemeName}_${string}`, ReturnType<typeof palette>>;
  fonts: Record<"body" | "heading" | "mono", typeof fontScale & { family: string }>;
  settings: { defaultFont: "body"; styleCompat: "react-native" };
  animations: AnimationDriver<AnimationPresets>;
  media: {}; shorthands: {};
};
type Configuration = Omit<ApplicationTamaguiConfig, "animations" | "media" | "shorthands"> & {
  animations: AnimationDriver<AnimationPresets>;
  defaultProps: Record<string, Record<string, string>>;
};
function configuration(palettes: Record<ApplicationThemeName, Palette>): Configuration {
  const themes = Object.fromEntries(Object.entries(palettes).flatMap(([name, p]) => {
    const base = palette(p);
    return [
      [name, base],
      ...["Button", "Card", "ListItem", "Sheet", "Dialog", "Popover", "Tooltip", "Select", "Switch", "Checkbox", "RadioGroup"].map(component =>
        [`${name}_${component}`, { ...base, background: p.surface }]),
      [`${name}_Input`, { ...base, background: p.field }],
      [`${name}_TextArea`, { ...base, background: p.field }],
      [`${name}_accent`, { ...base, background: p.accent, color: p.onAccent, colorHover: p.onAccent,
        colorPress: p.onAccent, colorFocus: p.onAccent, backgroundHover: p.accent, backgroundPress: p.accent,
        borderColor: p.accent }],
    ];
  })) as Record<ApplicationThemeName | `${ApplicationThemeName}_${string}`, ReturnType<typeof palette>>;
  return {
    themes,
    tokens: createTokens(tokenDefinitions),
    fonts: {
      body: createFont({ family: "sans-serif", ...fontScale }),
      heading: createFont({ family: "sans-serif", ...fontScale }),
      mono: createFont({ family: "monospace", ...fontScale }),
    },
    animations,
    settings: { defaultFont: "body", styleCompat: "react-native" } as const,
    defaultProps: {
      Text: { fontFamily: "$body", color: "$color" },
      Input: { placeholderTextColor: "$placeholderColor", selectionColor: "$accent" },
      TextArea: { placeholderTextColor: "$placeholderColor", selectionColor: "$accent" },
    },
  };
}

export function createApplicationTamaguiConfig(palettes: Record<ApplicationThemeName, Palette>): InferTamaguiConfig<Configuration> {
  return createTamagui(configuration(palettes));
}
declare module "tamagui" {
  interface TamaguiCustomConfig extends ApplicationTamaguiConfig {}
}
