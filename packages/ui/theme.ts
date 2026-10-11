import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { StyleSheet, useColorScheme, type TextStyle } from "react-native";

export type ThemeMode = "dark" | "light";
export type ThemePreference = ThemeMode | "system";
const radius = { xs: 6, sm: 10, md: 12, lg: 16, xl: 20, xxl: 26, window: 24, pill: 999 } as const;

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


  // 主强调色：电光紫，用于主操作与选中态。按钮使用 onAccent，文字链接使用 accentText。
  accent: string;
  accentTint: string;
  accentSoft: string;
  accentText: string;
  /** 铺在 accent 底色上的文字和图标。 */
  onAccent: string;

  // 辅色：热粉（同时是品牌信号色，用于未读、官方、链接、AI 等高光）
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

// One visual language: dopamine candy. Electric violet actions, hot pink signals, a candy palette for tiles.
const light = {
  canvas: "#FAF9FE", surface: "#FFFFFF", surfaceRaised: "#F2F0FA", inset: "#ECE9F6", field: "#FFFFFF",
  line: "#ECE9F4", lineStrong: "#D9D4EA", sheen: "rgba(255,255,255,0.9)", shade: "rgba(40,20,90,0.06)",
  ink1: "#1A1530", ink2: "#4E4868", ink3: "#8E89A6",
  accent: "#7B4DFF", accentText: "#6A3BF5", accentTint: "#F0EAFF", accentSoft: "#D6C8FF", onAccent: "#FFFFFF",
  orchid: "#FF3D8B", orchidText: "#E21F72", orchidTint: "#FFE8F1",
  cyan: "#1FB8FF", cyanText: "#0079B8", cyanTint: "#E3F6FF",
  green: "#1FCF6E", greenText: "#0B8A45", greenTint: "#E2FAEC",
  red: "#FF4757", redText: "#D91F33", redTint: "#FFE9EB",
  orange: "#FF8A1F", orangeText: "#C25A00", orangeTint: "#FFF0E0",
  amber: "#FFC21A", amberText: "#946B00", amberTint: "#FFF6D9",
  hover: "#F4F2FB", hover2: "#ECE9F6",
};
const dark = {
  canvas: "#0E0C16", surface: "#181524", surfaceRaised: "#221E33", inset: "#0A0910", field: "#181524",
  line: "#272339", lineStrong: "#3A3552", sheen: "rgba(255,255,255,0.06)", shade: "rgba(0,0,0,0.5)",
  ink1: "#F6F4FF", ink2: "#C4BFDA", ink3: "#8C86A6",
  accent: "#8B63FF", accentText: "#B49BFF", accentTint: "#2A2148", accentSoft: "#4A3A8A", onAccent: "#FFFFFF",
  orchid: "#FF5C9F", orchidText: "#FF94C0", orchidTint: "#3A1528",
  cyan: "#3DC6FF", cyanText: "#8ADCFF", cyanTint: "#0C2633",
  green: "#35DD80", greenText: "#86EDB3", greenTint: "#0D2A1B",
  red: "#FF5E6C", redText: "#FF959E", redTint: "#341219",
  orange: "#FF9A3D", orangeText: "#FFBF85", orangeTint: "#34200C",
  amber: "#FFCC3D", amberText: "#FFDE85", amberTint: "#33290A",
  hover: "#221E33", hover2: "#2B2640",
};
type TypeRole = "display" | "title1" | "title2" | "headline" | "body" | "callout" | "footnote" | "caption" | "overline";
const type: Record<TypeRole, TextStyle> = {
  display: { fontSize: 26, lineHeight: 32, fontWeight: "800", letterSpacing: -0.6 },
  title1: { fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.4 },
  title2: { fontSize: 18, lineHeight: 24, fontWeight: "700", letterSpacing: -0.3 },
  headline: { fontSize: 16, lineHeight: 21, fontWeight: "700", letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400", letterSpacing: 0 },
  callout: { fontSize: 14, lineHeight: 20, fontWeight: "500", letterSpacing: -0.1 },
  footnote: { fontSize: 12, lineHeight: 17, fontWeight: "500", letterSpacing: 0 },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: "500", letterSpacing: 0.1 },
  overline: { fontSize: 11, lineHeight: 14, fontWeight: "700", letterSpacing: 1 },
};
export type Theme = BaseTheme & {
  mode: ThemeMode; sans: string; onDanger: string; onOrchid: string;
  /** 糖果渐变（紫→粉→黄），只用于发布、AI 与少量品牌时刻。 */
  aurora: string;
  /** 页面氛围底：叠在 canvas 上的几团糖果色光晕，纵向只按距页面顶部的像素定位。 */
  ambient: string;
  /** 深色浮层（Toast、新内容提示）：两种模式下都是深紫玻璃。 */
  dock: string; dockLine: string; onDock: string; onDockMuted: string; dockActive: string; onDockActive: string;
  /** 投影层级：card 用于内容卡片，float 用于悬浮控件，modal 用于弹层。 */
  shadow: { card: string; float: string; modal: string };
  type: Record<TypeRole, TextStyle>;
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
  const isDark = mode === "dark";
  const colors: Theme = freeze({ ...palette, mode, sans: "sans-serif", mono: "monospace", serif: "sans-serif", radius,
    ink: palette.canvas, inkRaised: palette.surfaceRaised, text: palette.ink1, muted: palette.ink3,
    gold: palette.amber, goldDim: palette.amberText, danger: palette.red,
    onDanger: "#FFFFFF", onOrchid: "#FFFFFF",
    aurora: "linear-gradient(135deg, #7B4DFF 0%, #FF3D8B 55%, #FFB21A 100%)",
    ambient: isDark
      ? "radial-gradient(ellipse 420px 340px at 0px 0px, rgba(139,99,255,0.34) 0%, rgba(139,99,255,0.14) 45%, rgba(139,99,255,0) 100%), radial-gradient(ellipse 340px 280px at 100% 30px, rgba(255,92,159,0.20) 0%, rgba(255,92,159,0.08) 45%, rgba(255,92,159,0) 100%), radial-gradient(ellipse 320px 260px at 100% 440px, rgba(31,184,255,0.12) 0%, rgba(31,184,255,0.05) 45%, rgba(31,184,255,0) 100%), radial-gradient(ellipse 300px 240px at 0px 640px, rgba(255,194,26,0.07) 0%, rgba(255,194,26,0.03) 45%, rgba(255,194,26,0) 100%)"
      : "radial-gradient(ellipse 420px 340px at 0px 0px, rgba(123,77,255,0.24) 0%, rgba(123,77,255,0.10) 45%, rgba(123,77,255,0) 100%), radial-gradient(ellipse 340px 280px at 100% 30px, rgba(255,61,139,0.18) 0%, rgba(255,61,139,0.07) 45%, rgba(255,61,139,0) 100%), radial-gradient(ellipse 320px 260px at 100% 440px, rgba(31,184,255,0.12) 0%, rgba(31,184,255,0.05) 45%, rgba(31,184,255,0) 100%), radial-gradient(ellipse 300px 240px at 0px 640px, rgba(255,194,26,0.14) 0%, rgba(255,194,26,0.06) 45%, rgba(255,194,26,0) 100%)",
    dock: isDark ? "rgba(40,35,60,0.96)" : "rgba(26,21,48,0.94)",
    dockLine: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.06)",
    onDock: "#FFFFFF", onDockMuted: "rgba(255,255,255,0.56)",
    dockActive: "#FFFFFF", onDockActive: "#1A1530",
    shadow: isDark
      ? { card: "0 0 0 0 transparent", float: "0 12px 30px rgba(0,0,0,0.55)", modal: "0 24px 60px rgba(0,0,0,0.65)" }
      : { card: "0 1px 2px rgba(40,20,90,0.04), 0 6px 18px rgba(40,20,90,0.06)", float: "0 10px 28px rgba(40,20,90,0.16)", modal: "0 24px 60px rgba(40,20,90,0.18)" },
    type,
    typography: { body: "sans-serif", mono: "monospace", size: { body: 15, title: 18, caption: 12 }, lineHeight: { body: 22, title: 24, caption: 17 } },
    spacing: { page: 16, control: 12, item: 8, section: 20 }, motion: { press: 90, transition: 180 },
    components: { controlRadius: 12, dialogRadius: 24, surfaceBorder: StyleSheet.hairlineWidth, controlHeight: 44 },
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
