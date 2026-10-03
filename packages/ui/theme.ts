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
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 16,
  xxl: 20,
  window: 16,
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

export const palettes: Record<ThemeMode, Theme> = {
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
