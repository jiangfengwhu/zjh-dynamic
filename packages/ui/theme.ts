import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { StyleSheet, useColorScheme } from "react-native";

export type ThemeMode = "dark" | "light";
export type ThemePreference = ThemeMode | "system";
const radius = { xs: 6, sm: 12, md: 16, lg: 20, xl: 24, xxl: 28, window: 24, pill: 999 } as const;

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
  canvas: "#FAF7F0", surface: "#FFFEFA", surfaceRaised: "#F0ECE2", inset: "#EDE9DF", field: "#FFFEFA",
  line: "#E4DFD4", lineStrong: "#A9A294", sheen: "rgba(255,255,255,0.8)", shade: "rgba(43,43,37,0.08)",
  ink1: "#292C27", ink2: "#50564D", ink3: "#6A7065",
  accent: "#F16A45", accentText: "#AD3A1E", accentTint: "#FCE8DD", accentSoft: "#F5B49C", onAccent: "#292C27",
  orchid: "#D9CBF3", orchidText: "#655084", orchidTint: "#EEE7F7",
  cyan: "#B0DADC", cyanText: "#27646A", cyanTint: "#E4F0ED",
  green: "#B8D784", greenText: "#405C2A", greenTint: "#EBF1DF",
  red: "#E65B66", redText: "#A92738", redTint: "#FBE5E6",
  orange: "#F16A45", orangeText: "#AD3A1E", orangeTint: "#FCE8DD",
  amber: "#F5CC55", amberText: "#755719", amberTint: "#FBF0CA",
  hover: "#FCE8DD", hover2: "#F8D4C3",
  jollyFur: "#EFDDB0", jollyFace: "#FFF3CF", jollyBlush: "#EEA18F", jollyOrb: "#F5CC55",
};
const dark = {
  canvas: "#1C211D", surface: "#252C26", surfaceRaised: "#313A31", inset: "#18201A", field: "#252C26",
  line: "#3B443B", lineStrong: "#778273", sheen: "rgba(255,255,255,0.05)", shade: "rgba(0,0,0,0.2)",
  ink1: "#F7F1E4", ink2: "#D1D5C8", ink3: "#ADB7A5",
  accent: "#F59570", accentText: "#FFA582", accentTint: "#49352A", accentSoft: "#8D5A43", onAccent: "#27291F",
  orchid: "#C8B2EC", orchidText: "#D5C2F3", orchidTint: "#383244",
  cyan: "#A0D3D5", cyanText: "#B0E1DF", cyanTint: "#263E3C",
  green: "#C1DC95", greenText: "#C1DC95", greenTint: "#33412A",
  red: "#F38B94", redText: "#FFA7AF", redTint: "#482C32",
  orange: "#F59570", orangeText: "#FFA582", orangeTint: "#49352A",
  amber: "#F5D473", amberText: "#F5D473", amberTint: "#443F28",
  hover: "#49352A", hover2: "#604536",
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
    onDanger: "#292C27", onOrchid: "#292C27",
    typography: { body: "sans-serif", mono: "monospace", size: { body: 15, title: 24, caption: 13 }, lineHeight: { body: 23, title: 31, caption: 19 } },
    spacing: { page: 20, control: 14, item: 8, section: 24 }, motion: { press: 100, transition: 180 },
    components: { controlRadius: 16, dialogRadius: 24, surfaceBorder: StyleSheet.hairlineWidth, controlHeight: 48 },
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
