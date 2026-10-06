import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { TamaguiProvider } from "tamagui";
import { createApplicationTamaguiConfig } from "../app-sdk/src/tamagui-config";
import "./tamagui-native";

export type ThemeMode = "dark" | "light";
export type ThemePreference = ThemeMode | "system";
export type SkinId = "pixel-street" | "soft";
export const skins: readonly { id: SkinId; title: string; description: string }[] = [
  { id: "pixel-street", title: "Pixel Street", description: "像素字体、利落轮廓与多巴胺亮色" },
  { id: "soft", title: "Soft", description: "系统字体、柔和圆角与清晰层次" },
];

const fonts = {
  mono: "Fusion Pixel 12px Proportional SC",
  sans: "Fusion Pixel 12px Proportional SC",
  serif: "Fusion Pixel 12px Proportional SC",
};

const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 16,
  xxl: 20,
  window: 16,
  pill: 999,
} as const;

type BaseTheme = {
  // Semantic colors shared by the host and application UI.
  ink: string;
  inkRaised: string;
  line: string;
  gold: string;
  goldDim: string;
  text: string;
  muted: string;
  danger: string;

  // Semantic surface tokens
  canvas: string;
  surface: string;
  surfaceRaised: string;
  inset: string;
  field: string;
  hover: string;
  hover2: string;
  lineStrong: string;
  /** 卡片顶沿的高光，让表面有一点厚度。 */
  sheen: string;
  /** 卡片顶沿之下的暗部，和 sheen 一起使用。 */
  shade: string;

  ink1: string;
  ink2: string;
  ink3: string;

  // Jolly Companion Character Palette
  jollyFur: string;
  jollyFace: string;
  jollyBlush: string;
  jollyOrb: string;

  // 酸橙强调色：按钮使用 onAccent，文字链接使用独立高对比色。
  accent: string;
  accentTint: string;
  accentSoft: string;
  accentText: string;
  /** 铺在 accent 底色上的文字和图标。 */
  onAccent: string;

  // 辅色：紫花
  orchid: string;
  orchidTint: string;
  orchidText: string;

  cyan: string;
  cyanTint: string;
  cyanText: string;

  green: string;
  greenTint: string;
  greenText: string;

  red: string;
  redTint: string;
  redText: string;

  orange: string;
  orangeTint: string;
  orangeText: string;
  amber: string;
  amberTint: string;
  amberText: string;

  mono: string;
  serif: string;
  radius: typeof radius;
};

const basePalettes: Record<ThemeMode, BaseTheme> = {
  dark: {
    // 石墨与银灰，酸橙仅用于主操作和选中状态。
    ink: "#141517",
    inkRaised: "#2B2D30",
    line: "#303237",
    gold: "#D5F478",
    goldDim: "#ABC95F",
    text: "#F3F4F0",
    muted: "#A1A5AD",
    danger: "#E58A9B",

    canvas: "#141517",
    surface: "#1C1E21",
    surfaceRaised: "#2B2D30",
    inset: "#101113",
    field: "#2B2D30",
    hover: "#2C3520",
    hover2: "#384526",
    lineStrong: "#747984",
    sheen: "rgba(255, 255, 255, 0.07)",
    shade: "rgba(0, 0, 0, 0.22)",

    ink1: "#F3F4F0",
    ink2: "#C5C8CF",
    ink3: "#A1A5AD",

    jollyFur: "#E8DECE",
    jollyFace: "#FEECE0",
    jollyBlush: "#FDA4AF",
    jollyOrb: "#EFCF83",

    accent: "#D5F478",
    accentTint: "#2C3520",
    accentSoft: "#46562A",
    accentText: "#D5F478",
    onAccent: "#1E280D",

    orchid: "#A88BEB",
    orchidTint: "rgba(168, 139, 235, 0.16)",
    orchidText: "#C4B0F5",

    cyan: "#7CC6D8",
    cyanTint: "rgba(124, 198, 216, 0.14)",
    cyanText: "#A2D9E6",

    green: "#7BC7A0",
    greenTint: "rgba(123, 199, 160, 0.14)",
    greenText: "#A1DBBC",

    red: "#E58A9B",
    redTint: "rgba(229, 138, 155, 0.14)",
    redText: "#F0AAB7",

    orange: "#E0A06A",
    orangeTint: "rgba(224, 160, 106, 0.14)",
    orangeText: "#EBBB90",
    amber: "#E5C36A",
    amberTint: "rgba(229, 195, 106, 0.14)",
    amberText: "#EFD68F",

    mono: fonts.mono,
    serif: fonts.serif,
    radius,
  },
  light: {
    // 冷白与石墨，沿用深色主题的信息层级。
    ink: "#F2F3F0",
    inkRaised: "#FCFCFA",
    line: "#DADDD6",
    gold: "#D5F478",
    goldDim: "#647C2C",
    text: "#1B1D20",
    muted: "#63696F",
    danger: "#C43D5A",

    canvas: "#F2F3F0",
    surface: "#FCFCFA",
    surfaceRaised: "#E9ECE5",
    inset: "#E8EBE3",
    field: "#FCFCFA",
    hover: "#E7EFCF",
    hover2: "#D7E5B3",
    lineStrong: "#808774",
    sheen: "rgba(255, 255, 255, 0.9)",
    shade: "rgba(27, 29, 32, 0.10)",

    ink1: "#1B1D20",
    ink2: "#444A50",
    ink3: "#63696F",

    jollyFur: "#EFDDB0",
    jollyFace: "#FFF3CF",
    jollyBlush: "#EEA18F",
    jollyOrb: "#EBCB78",

    accent: "#D5F478",
    accentTint: "#E7EFCF",
    accentSoft: "#D7E5B3",
    accentText: "#496017",
    onAccent: "#1E280D",

    orchid: "#7A5BD0",
    orchidTint: "rgba(122, 91, 208, 0.10)",
    orchidText: "#5E40B0",

    cyan: "#1F86A0",
    cyanTint: "rgba(31, 134, 160, 0.10)",
    cyanText: "#136982",

    green: "#26735E",
    greenTint: "rgba(46, 158, 110, 0.10)",
    greenText: "#236651",

    red: "#C43D5A",
    redTint: "rgba(196, 61, 90, 0.09)",
    redText: "#A32A46",

    orange: "#C2652A",
    orangeTint: "rgba(194, 101, 42, 0.10)",
    orangeText: "#9E4E1B",
    amber: "#B7860F",
    amberTint: "rgba(183, 134, 15, 0.11)",
    amberText: "#8A6408",

    mono: fonts.mono,
    serif: fonts.serif,
    radius,
  },
};


function pixelPalette(mode: ThemeMode): BaseTheme {
  const dark = mode === "dark";
  return {
    ...basePalettes[mode],
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

export type Theme = BaseTheme & {
  skin: SkinId; mode: ThemeMode; sans: string; onDanger: string; onOrchid: string;
  typography: { body: string; mono: string; size: { body: number; title: number; caption: number }; lineHeight: { body: number; title: number; caption: number } };
  spacing: { page: number; control: number; item: number; section: number };
  motion: { press: number; transition: number };
  components: { controlRadius: number; dialogRadius: number; surfaceBorder: number; controlHeight: number };
};
const cache = new Map<string, Theme>();
function freeze<T extends object>(value: T): T {
  for (const child of Object.values(value)) if (child && typeof child === "object" && !Object.isFrozen(child)) freeze(child);
  return Object.freeze(value);
}
export function getTheme(skin: SkinId, mode: ThemeMode): Theme {
  const key = skin + ":" + mode;
  const existing = cache.get(key);
  if (existing) return existing;
  const pixel = skin === "pixel-street", dark = mode === "dark";
  const base = pixel ? pixelPalette(mode) : { ...basePalettes[mode],
    canvas: dark ? "#141722" : "#F4F5FA", surface: dark ? "#1E2230" : "#FFFFFF",
    surfaceRaised: dark ? "#292E40" : "#EDF0F8", field: dark ? "#242938" : "#FFFFFF", inset: dark ? "#191D29" : "#E9ECF4",
    ink1: dark ? "#F3F4FC" : "#22283B", ink2: dark ? "#C7CCDE" : "#505A73", ink3: dark ? "#A5ADC7" : "#626C84",
    line: dark ? "#353D54" : "#DBE0ED", lineStrong: dark ? "#59647E" : "#929CB3",
    accent: dark ? "#B1A4FF" : "#6954CD", onAccent: dark ? "#211B3D" : "#FFFFFF", accentText: dark ? "#C9BEFF" : "#5942B8",
    accentTint: dark ? "#34304E" : "#EEE9FF", accentSoft: dark ? "#7666BB" : "#C3B6F3", hover: dark ? "#34304E" : "#EEE9FF",
    mono: "monospace", serif: "sans-serif", radius: { xs: 4, sm: 10, md: 14, lg: 18, xl: 22, xxl: 26, window: 22, pill: 999 },
  };
  const colors = freeze({ ...base, skin, mode, sans: pixel ? fonts.sans : "sans-serif", text: base.ink1, muted: base.ink3, ink: base.canvas, inkRaised: base.surfaceRaised,
    gold: base.accent, goldDim: base.accentSoft, danger: base.red,
    onDanger: dark || pixel ? "#30233F" : "#FFFFFF", onOrchid: dark || pixel ? "#30233F" : "#FFFFFF",
    field: pixel ? base.surface : base.field, hover: pixel ? base.accentTint : base.hover,
    mono: pixel ? fonts.mono : "monospace", serif: pixel ? fonts.serif : "sans-serif",
    radius: pixel ? { xs: 0, sm: 0, md: 0, lg: 0, xl: 0, xxl: 0, window: 0, pill: 999 } : base.radius,
    typography: { body: pixel ? fonts.sans : "sans-serif", mono: pixel ? fonts.mono : "monospace",
      size: { body: 15, title: 21, caption: 12 }, lineHeight: { body: 23, title: 29, caption: 18 } },
    spacing: { page: 16, control: 12, item: 8, section: 20 }, motion: { press: 90, transition: 180 },
    components: { controlRadius: pixel ? 0 : 12, dialogRadius: pixel ? 0 : 22, surfaceBorder: pixel ? 1 : StyleSheet.hairlineWidth, controlHeight: 44 },
  }) as Theme;
  cache.set(key, colors);
  return colors;
}
export type ThemeContextValue = {
  mode: ThemeMode; preference: ThemePreference; skin: SkinId; colors: Theme;
  setMode: (mode: ThemePreference) => void; setSkin: (skin: SkinId) => void;
};
const tamaguiConfig = createApplicationTamaguiConfig({
  light_pixel: getTheme("pixel-street", "light"), dark_pixel: getTheme("pixel-street", "dark"),
  light_soft: getTheme("soft", "light"), dark_soft: getTheme("soft", "dark"),
});
const defaultTheme: ThemeContextValue = { mode: "dark", preference: "dark", skin: "pixel-street", colors: getTheme("pixel-street", "dark"), setMode: () => {}, setSkin: () => {} };
export const ThemeContext = createContext<ThemeContextValue>(defaultTheme);
export function ThemeProvider({ mode, skin, onMode, onSkin, children }: {
  mode?: ThemePreference; skin?: SkinId; onMode?: (mode: ThemePreference) => void; onSkin?: (skin: SkinId) => void; children: ReactNode;
}) {
  const parent = useContext(ThemeContext), system = useColorScheme();
  const preference = mode ?? parent.preference, activeSkin = skin ?? parent.skin;
  const resolvedMode = preference === "system" ? (system === "light" ? "light" : "dark") : preference;
  const value = useMemo<ThemeContextValue>(() => ({ mode: resolvedMode, preference, skin: activeSkin, colors: getTheme(activeSkin, resolvedMode),
    setMode: onMode ?? (mode === undefined ? parent.setMode : () => {}),
    setSkin: onSkin ?? (skin === undefined ? parent.setSkin : () => {}),
  }), [resolvedMode, preference, activeSkin, onMode, onSkin, mode, skin, parent.setMode, parent.setSkin]);
  return createElement(ThemeContext.Provider, { value },
    createElement(TamaguiProvider, { config: tamaguiConfig, defaultTheme: `${resolvedMode}_${activeSkin === "pixel-street" ? "pixel" : "soft"}` }, children));
}
export function useTheme(): ThemeContextValue { return useContext(ThemeContext); }
export function createThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(factory: (theme: Theme) => T): () => T {
  const styles = new WeakMap<Theme, T>();
  return function useStyles() {
    const { colors } = useTheme();
    let value = styles.get(colors);
    if (!value) { value = StyleSheet.create(factory(colors)); styles.set(colors, value); }
    return value;
  };
}
