import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { Platform, StyleSheet } from "react-native";
import { readPackageValue, subscribePackageValue, writePackageValue } from "./packageLink";

export type ThemeMode = "dark" | "light";

export const fonts = {
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  sans: Platform.select({ ios: "System", android: "sans-serif", default: "System" }),
  /** 标题、字标、数字用衬线；正文仍用无衬线。 */
  serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
} as const;

const radius = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 30,
  window: 22,
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

  // 主色：金箔。按钮、选中、进度都用它
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
    ink: "#100C15",
    inkRaised: "#1F192B",
    line: "#2A2336",
    gold: "#D9B46C",
    goldDim: "#8F7743",
    text: "#F3EEF8",
    muted: "#8E8499",
    danger: "#E58A9B",

    canvas: "#100C15",
    surface: "#171220",
    surfaceRaised: "#1F192B",
    inset: "#0C0910",
    field: "#130F1A",
    hover: "#272035",
    hover2: "#322A42",
    lineStrong: "#3A3149",
    sheen: "rgba(255, 255, 255, 0.07)",
    shade: "rgba(0, 0, 0, 0.22)",

    ink1: "#F3EEF8",
    ink2: "#CBC2D6",
    ink3: "#8E8499",

    jollyFur: "#E8DECE",
    jollyFace: "#FEECE0",
    jollyBlush: "#FDA4AF",
    jollyOrb: "#A78BFA",

    accent: "#D9B46C",
    accentTint: "rgba(217, 180, 108, 0.13)",
    accentSoft: "rgba(217, 180, 108, 0.22)",
    accentText: "#E7C98B",
    onAccent: "#1C1408",

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
    ink: "#F5F3F8",
    inkRaised: "#FFFFFF",
    line: "#E3DDEB",
    gold: "#9A6A14",
    goldDim: "#7B5A24",
    text: "#1B1524",
    muted: "#7D7189",
    danger: "#C43D5A",

    canvas: "#F5F3F8",
    surface: "#FFFFFF",
    surfaceRaised: "#EFEBF4",
    inset: "#E8E3EF",
    field: "#FFFFFF",
    hover: "#EAE5F1",
    hover2: "#DFD8E9",
    lineStrong: "#CFC6DB",
    sheen: "rgba(255, 255, 255, 0.9)",
    shade: "rgba(60, 40, 90, 0.05)",

    ink1: "#1B1524",
    ink2: "#4A4056",
    ink3: "#7D7189",

    jollyFur: "#DFD2C0",
    jollyFace: "#FEECE0",
    jollyBlush: "#FB7185",
    jollyOrb: "#8B5CF6",

    accent: "#9A6A14",
    accentTint: "rgba(154, 106, 20, 0.10)",
    accentSoft: "rgba(154, 106, 20, 0.17)",
    accentText: "#7B520B",
    onAccent: "#FFFFFF",

    orchid: "#7A5BD0",
    orchidTint: "rgba(122, 91, 208, 0.10)",
    orchidText: "#5E40B0",

    cyan: "#1F86A0",
    cyanTint: "rgba(31, 134, 160, 0.10)",
    cyanText: "#136982",

    green: "#2E9E6E",
    greenTint: "rgba(46, 158, 110, 0.10)",
    greenText: "#1E7A52",

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
