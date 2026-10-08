import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import { StyleSheet, useColorScheme, type TextStyle } from "react-native";

export type ThemeMode = "dark" | "light";
export type ThemePreference = ThemeMode | "system";
const radius = { xs: 8, sm: 12, md: 16, lg: 22, xl: 28, xxl: 36, window: 32, pill: 999 } as const;

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

  // 主强调色：单色墨（浅色为墨黑，深色为瓷白）。按钮使用 onAccent，文字链接使用 accentText。
  accent: string;
  accentTint: string;
  accentSoft: string;
  accentText: string;
  /** 铺在 accent 底色上的文字和图标。 */
  onAccent: string;

  // 辅色：紫花（同时是品牌信号色，用于未读、选中、AI 等少量高光）
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

// One visual language: porcelain and obsidian, monochrome actions, a single aurora highlight.
const light = {
  canvas: "#F4F3F0", surface: "#FFFFFF", surfaceRaised: "#ECEBE7", inset: "#E7E6E1", field: "#FFFFFF",
  line: "#E5E3DE", lineStrong: "#CBC9C2", sheen: "rgba(255,255,255,0.9)", shade: "rgba(24,20,14,0.07)",
  ink1: "#0C0C0D", ink2: "#47474D", ink3: "#88878E",
  accent: "#0C0C0D", accentText: "#0C0C0D", accentTint: "#ECEBE7", accentSoft: "#CBC9C2", onAccent: "#FFFFFF",
  orchid: "#7357FF", orchidText: "#5B3FF0", orchidTint: "#EFEBFF",
  cyan: "#3AA9D6", cyanText: "#0A6589", cyanTint: "#E5F3F9",
  green: "#2DBE74", greenText: "#117A45", greenTint: "#E4F5EB",
  red: "#EF4238", redText: "#CC2A21", redTint: "#FDEBE9",
  orange: "#FF8A3D", orangeText: "#B0500E", orangeTint: "#FFF0E3",
  amber: "#F2B533", amberText: "#875800", amberTint: "#FBF2DC",
  hover: "#EFEEEA", hover2: "#E6E5E0",
  jollyFur: "#EFDDB0", jollyFace: "#FFF3CF", jollyBlush: "#EEA18F", jollyOrb: "#F5CC55",
};
const dark = {
  canvas: "#08080A", surface: "#131316", surfaceRaised: "#1D1D21", inset: "#040405", field: "#131316",
  line: "#232328", lineStrong: "#3B3B42", sheen: "rgba(255,255,255,0.06)", shade: "rgba(0,0,0,0.55)",
  ink1: "#F4F4F6", ink2: "#B6B6BE", ink3: "#7C7C85",
  accent: "#F4F4F6", accentText: "#F4F4F6", accentTint: "#1D1D21", accentSoft: "#3B3B42", onAccent: "#0C0C0D",
  orchid: "#9783FF", orchidText: "#B7A8FF", orchidTint: "#1E1936",
  cyan: "#56C1E8", cyanText: "#8AD5F1", cyanTint: "#0D242E",
  green: "#3BD787", greenText: "#7DE6AF", greenTint: "#0E271A",
  red: "#FF5A51", redText: "#FF8A83", redTint: "#321313",
  orange: "#FF9B56", orangeText: "#FFBA8B", orangeTint: "#321E0E",
  amber: "#FFC84C", amberText: "#FFD985", amberTint: "#2F250B",
  hover: "#1D1D21", hover2: "#26262B",
  jollyFur: "#E8DECE", jollyFace: "#FEECE0", jollyBlush: "#FDA4AF", jollyOrb: "#F5D473",
};
type TypeRole = "display" | "title1" | "title2" | "headline" | "body" | "callout" | "footnote" | "caption" | "overline";
const type: Record<TypeRole, TextStyle> = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: "800", letterSpacing: -0.9 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.4 },
  headline: { fontSize: 17, lineHeight: 23, fontWeight: "700", letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 25, fontWeight: "400", letterSpacing: 0 },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: "500", letterSpacing: -0.1 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "500", letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500", letterSpacing: 0.1 },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: "700", letterSpacing: 1.2 },
};
export type Theme = BaseTheme & {
  mode: ThemeMode; sans: string; onDanger: string; onOrchid: string;
  /** 品牌极光渐变，只用于发布、AI 与少量品牌时刻。 */
  aurora: string;
  /** 悬浮导航坞与浮层工具条：两种模式下都是深色玻璃。 */
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
    aurora: "linear-gradient(135deg, #7357FF 0%, #E15BFF 52%, #FF9F5A 100%)",
    dock: isDark ? "rgba(28,28,32,0.94)" : "rgba(12,12,13,0.94)",
    dockLine: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.06)",
    onDock: "#FFFFFF", onDockMuted: "rgba(255,255,255,0.52)",
    dockActive: "#FFFFFF", onDockActive: "#0C0C0D",
    shadow: isDark
      ? { card: "0 0 0 0 transparent", float: "0 18px 40px rgba(0,0,0,0.6)", modal: "0 30px 80px rgba(0,0,0,0.7)" }
      : { card: "0 1px 2px rgba(24,20,14,0.04), 0 10px 28px rgba(24,20,14,0.05)", float: "0 16px 36px rgba(12,12,13,0.22)", modal: "0 30px 80px rgba(24,20,14,0.18)" },
    type,
    typography: { body: "sans-serif", mono: "monospace", size: { body: 16, title: 22, caption: 13 }, lineHeight: { body: 25, title: 28, caption: 18 } },
    spacing: { page: 20, control: 14, item: 8, section: 28 }, motion: { press: 90, transition: 200 },
    components: { controlRadius: 16, dialogRadius: 32, surfaceBorder: StyleSheet.hairlineWidth, controlHeight: 52 },
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
