import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { Platform, StyleSheet } from "react-native";
import { readPackageValue, subscribePackageValue, writePackageValue } from "./packageLink";

export type ThemeMode = "dark" | "light";

export const fonts = {
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  sans: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  /** 保留公共字段名，标题与正文统一采用平台无衬线字体。 */
  serif: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
} as const;

const radius = {
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  window: 14,
  pill: 999,
} as const;

export type Theme = {
  // Legacy / shell compatibility tokens
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

  // 主色：紫金花。按钮、选中、进度共用。
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

export const palettes: Record<ThemeMode, Theme> = {
  dark: {
    // 夜紫：带一点紫的墨色底，金箔只落在关键处
    ink: "#19181F",
    inkRaised: "#24222C",
    line: "#34303F",
    gold: "#BAA6F3",
    goldDim: "#A391D1",
    text: "#EEECF5",
    muted: "#AAA5B8",
    danger: "#E58A9B",

    canvas: "#19181F",
    surface: "#1D1B25",
    surfaceRaised: "#24222C",
    inset: "#15141B",
    field: "#24222C",
    hover: "#30283F",
    hover2: "#3C324E",
    lineStrong: "#4B4359",
    sheen: "rgba(255, 255, 255, 0.07)",
    shade: "rgba(0, 0, 0, 0.22)",

    ink1: "#EEECF5",
    ink2: "#D0CADC",
    ink3: "#AAA5B8",

    jollyFur: "#E8DECE",
    jollyFace: "#FEECE0",
    jollyBlush: "#FDA4AF",
    jollyOrb: "#A78BFA",

    accent: "#BAA6F3",
    accentTint: "#30283F",
    accentSoft: "#443457",
    accentText: "#C5B2F5",
    onAccent: "#21192F",

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
    // 淡紫纸：偏冷的白，墨色文字，金箔加深以保证可读
    ink: "#FFFFFF",
    inkRaised: "#FFFFFF",
    line: "#E9E7EF",
    gold: "#644BC1",
    goldDim: "#7761B8",
    text: "#24232C",
    muted: "#74717F",
    danger: "#C43D5A",

    canvas: "#FFFFFF",
    surface: "#FFFFFF",
    surfaceRaised: "#F7F7FA",
    inset: "#F0EEF5",
    field: "#FFFFFF",
    hover: "#F0ECFA",
    hover2: "#E8E1F5",
    lineStrong: "#D5CFDF",
    sheen: "rgba(255, 255, 255, 0.9)",
    shade: "rgba(60, 40, 90, 0.05)",

    ink1: "#24232C",
    ink2: "#514C5E",
    ink3: "#74717F",

    jollyFur: "#DFD2C0",
    jollyFace: "#FEECE0",
    jollyBlush: "#FB7185",
    jollyOrb: "#8B5CF6",

    accent: "#644BC1",
    accentTint: "#F0ECFA",
    accentSoft: "#E5DDF5",
    accentText: "#5B42AF",
    onAccent: "#FFFFFF",

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

const THEME_KEY = "theme.mode";

let activeMode: ThemeMode = "dark";

export const theme: Theme = { ...palettes.dark };

function applyThemeMode(mode: ThemeMode) {
  activeMode = mode;
  Object.assign(theme, palettes[mode]);
}

export function setActiveThemeMode(mode: ThemeMode) {
  applyThemeMode(mode);
  writePackageValue(THEME_KEY, mode);
}

const storedTheme = readPackageValue(THEME_KEY);
if (storedTheme === "light" || storedTheme === "dark") applyThemeMode(storedTheme);

subscribePackageValue(THEME_KEY, (value) => {
  if ((value === "light" || value === "dark") && value !== activeMode) applyThemeMode(value);
});

export function getActiveThemeMode(): ThemeMode {
  return activeMode;
}

export type ThemeContextValue = {
  mode: ThemeMode;
  colors: Theme;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  colors: palettes.dark,
  setMode: (next: ThemeMode) => {
    setActiveThemeMode(next);
  },
});

export function ThemeProvider({
  mode,
  onMode,
  children,
}: {
  mode: ThemeMode;
  onMode: (mode: ThemeMode) => void;
  children: ReactNode;
}) {
  setActiveThemeMode(mode);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: palettes[mode],
      setMode: (next: ThemeMode) => {
        setActiveThemeMode(next);
        onMode(next);
      },
    }),
    [mode, onMode]
  );

  return createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function themedStyleSheet<
  T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>,
>(factory: (t: Theme) => T): T {
  const cache: Partial<Record<ThemeMode, T>> = {};
  return new Proxy({} as T, {
    get(_, prop: string | symbol) {
      const m = activeMode;
      if (!cache[m]) {
        Object.assign(theme, palettes[m]);
        cache[m] = StyleSheet.create(factory(palettes[m]));
      }
      return (cache[m] as any)[prop];
    },
  });
}
