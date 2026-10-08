import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { StyleSheet, useColorScheme } from "react-native";

export type ThemeMode = "dark" | "light";
export type ThemePreference = ThemeMode | "system";
const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 24, xxl: 32, window: 28, pill: 999 } as const;

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


// A single visual language: warm paper, ink, coral, and small optimistic accents.
const light = {
  canvas: "#F4F3EF", surface: "#FFFFFF", surfaceRaised: "#ECEBE6", inset: "#E8E7E1", field: "#FFFFFF",
  line: "#E3E2DC", lineStrong: "#C4C3BB", sheen: "rgba(255,255,255,0.8)", shade: "rgba(17,17,20,0.08)",
  ink1: "#121214", ink2: "#45454B", ink3: "#6B6B73",
  accent: "#3B4BFF", accentText: "#2B39E0", accentTint: "#E8EAFF", accentSoft: "#B8BFFF", onAccent: "#FFFFFF",
  orchid: "#F4BFE4", orchidText: "#A1207C", orchidTint: "#FCEBF6",
  cyan: "#BDE5F4", cyanText: "#0A6283", cyanTint: "#E5F4FA",
  green: "#C9EE62", greenText: "#3A6200", greenTint: "#EFF8D5",
  red: "#DC3E42", redText: "#BF2329", redTint: "#FDE8E7",
  orange: "#FF9A52", orangeText: "#AD4700", orangeTint: "#FFEEDF",
  amber: "#FFD447", amberText: "#765300", amberTint: "#FFF5CF",
  hover: "#ECEBE6", hover2: "#E2E1DA",
  jollyFur: "#EFDDB0", jollyFace: "#FFF3CF", jollyBlush: "#EEA18F", jollyOrb: "#F5CC55",
};
const dark = {
  canvas: "#0D0D10", surface: "#17171C", surfaceRaised: "#222228", inset: "#09090B", field: "#17171C",
  line: "#2A2A31", lineStrong: "#4A4A54", sheen: "rgba(255,255,255,0.05)", shade: "rgba(0,0,0,0.45)",
  ink1: "#F3F3F5", ink2: "#C2C2CB", ink3: "#8F8F9A",
  accent: "#5B6CFF", accentText: "#A3ADFF", accentTint: "#1D2152", accentSoft: "#3B47B8", onAccent: "#FFFFFF",
  orchid: "#E9A8D8", orchidText: "#F4BCE5", orchidTint: "#38192F",
  cyan: "#8ED4EC", cyanText: "#A8E1F4", cyanTint: "#102E3A",
  green: "#C3EC55", greenText: "#CDEF70", greenTint: "#232E0E",
  red: "#FF6B6E", redText: "#FF9396", redTint: "#3B1719",
  orange: "#FFA061", orangeText: "#FFB886", orangeTint: "#3A2212",
  amber: "#FFD450", amberText: "#FFDD75", amberTint: "#362C0E",
  hover: "#222228", hover2: "#2C2C34",
  jollyFur: "#E8DECE", jollyFace: "#FEECE0", jollyBlush: "#FDA4AF", jollyOrb: "#F5D473",
};
export type Theme = BaseTheme & {
  mode: ThemeMode; sans: string; onDanger: string; onOrchid: string;
  typography: { body: string; mono: string; size: { body: number; title: number; caption: number }; lineHeight: { body: number; title: number; caption: number } };
  spacing: { page: number; control: number; item: number; section: number };
  motion: { press: number; transition: number };
  components: { controlRadius: number; dialogRadius: number; surfaceBorder: number; controlHeight: number };
};
const cache = new Map<ThemeMode, Theme>();
function freeze<T extends object>(value: T): T {
  for (const child of Object.values(value)) if (child && typeof child === "object" && !Object.isFrozen(child)) freeze(child);
  return Object.freeze(value);
}
export function getTheme(mode: ThemeMode): Theme {
  const existing = cache.get(mode);
  if (existing) return existing;
  const palette = mode === "dark" ? dark : light;
  const colors: Theme = freeze({ ...palette, mode, sans: "sans-serif", mono: "monospace", serif: "sans-serif", radius,
    ink: palette.canvas, inkRaised: palette.surfaceRaised, text: palette.ink1, muted: palette.ink3,
    gold: palette.amber, goldDim: palette.amberText, danger: palette.red,
    onDanger: mode === "dark" ? "#1A0B0C" : "#FFFFFF", onOrchid: "#141416",
    typography: { body: "sans-serif", mono: "monospace", size: { body: 15, title: 22, caption: 13 }, lineHeight: { body: 23, title: 30, caption: 18 } },
    spacing: { page: 20, control: 14, item: 8, section: 24 }, motion: { press: 100, transition: 180 },
    components: { controlRadius: 14, dialogRadius: 28, surfaceBorder: StyleSheet.hairlineWidth, controlHeight: 48 },
  });
  cache.set(mode, colors);
  return colors;
}
export type ThemeContextValue = {
  mode: ThemeMode; preference: ThemePreference; colors: Theme;
  setMode: (mode: ThemePreference) => void;
};
const defaultTheme: ThemeContextValue = { mode: "light", preference: "system", colors: getTheme("light"), setMode: () => {} };
export const ThemeContext = createContext<ThemeContextValue>(defaultTheme);
export function ThemeProvider({ mode, onMode, children }: {
  mode?: ThemePreference; onMode?: (mode: ThemePreference) => void; children: ReactNode;
}) {
  const parent = useContext(ThemeContext), system = useColorScheme();
  const preference = mode ?? parent.preference;
  const resolvedMode = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
  const value = useMemo<ThemeContextValue>(() => ({ mode: resolvedMode, preference, colors: getTheme(resolvedMode),
    setMode: onMode ?? (mode === undefined ? parent.setMode : () => {}),
  }), [resolvedMode, preference, onMode, mode, parent.setMode]);
  return createElement(ThemeContext.Provider, { value }, children);
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
