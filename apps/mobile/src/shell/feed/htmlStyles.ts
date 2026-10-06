import type { BoxShadowValue, TextStyle, ViewStyle } from "react-native";
import { getStylesForProperty } from "css-to-react-native";

type CssNode = { type: string; name?: string; unit?: string; property?: string; important?: boolean; children?: { forEach: (callback: (node: CssNode) => void) => void }; value?: CssNode | string };
const cssTree: { parse: (value: string, options: { context: string }) => CssNode; generate: (node: CssNode) => string; walk: (node: CssNode, callback: (node: CssNode) => void) => void } = require("css-tree");

type HtmlElement = { attribs: Record<string, string>; parent: unknown };
const rootFontSize = 15;
type Viewport = { width: number; height: number };
const originals = new WeakMap<HtmlElement, Record<string, string>>();
const prepared = new WeakMap<Record<string, string>, Record<string, string>>();

// Reuse the parser already shipped with SVG; do not parse CSS with string splitting.
function splitCss(value: string, separator: string) {
  const parts: string[] = [];
  let part = "";
  try {
    cssTree.parse(value, { context: "value" }).children?.forEach(node => {
      const text = cssTree.generate(node);
      if (text === separator || separator === " " && node.type === "WhiteSpace") { if (part.trim()) parts.push(part.trim()); part = ""; }
      else part += text;
    });
  } catch { return [value.trim()].filter(Boolean); }
  if (part.trim()) parts.push(part.trim());
  return parts;
}

function declarations(style: string) {
  const result: Record<string, string> = {}, important = new Set<string>();
  try {
    cssTree.parse(style, { context: "declarationList" }).children?.forEach(node => {
      if (node.type !== "Declaration" || !node.property || !node.value || typeof node.value !== "object") return;
      const name = node.property.startsWith("--") ? node.property : node.property.toLowerCase();
      if (important.has(name) && !node.important) return;
      if (node.important) important.add(name);
      delete result[name];
      result[name] = cssTree.generate(node.value);
    });
  } catch { /* Malformed CSS cannot prevent the HTML text from being displayed. */ }
  return result;
}

function resolveVars(value: string, variables: Record<string, string>, depth = 0): string {
  if (depth > 8) return "";
  if (!value.includes("var(")) return value;
  try {
    const ast = cssTree.parse(value, { context: "value" });
    cssTree.walk(ast, node => {
      if (node.type !== "Function" || node.name !== "var") return;
      const [name, ...fallback] = splitCss(cssTree.generate({ type: "Value", children: node.children }), ",");
      node.type = "Raw";
      node.value = resolveVars(variables[name] ?? fallback.join(","), variables, depth + 1);
      delete node.children;
      delete node.name;
    });
    return cssTree.generate(ast);
  } catch { return ""; }
}

function resolveUnits(value: string, fontSize: number, viewport?: Viewport) {
  try {
    const ast = cssTree.parse(value, { context: "value" });
    cssTree.walk(ast, node => {
      if (node.type !== "Dimension") return;
      const scale = node.unit === "em" ? fontSize : node.unit === "rem" ? rootFontSize
        : !viewport ? undefined : node.unit === "vw" ? viewport.width / 100 : node.unit === "vh" ? viewport.height / 100
        : node.unit === "vmin" ? Math.min(viewport.width, viewport.height) / 100 : node.unit === "vmax" ? Math.max(viewport.width, viewport.height) / 100 : undefined;
      if (scale !== undefined) { node.value = String(Number(node.value) * scale); node.unit = "px"; }
    });
    return cssTree.generate(ast);
  } catch { return value; }
}

function length(value: string, fontSize = rootFontSize, percentBase?: number) {
  const match = /^(-?\d*\.?\d+)(px|em|rem|%)?$/.exec(value);
  if (!match) return;
  const number = Number(match[1]);
  const result = match[2] === "em" ? number * fontSize : match[2] === "rem" ? number * rootFontSize
    : match[2] === "%" ? percentBase === undefined ? NaN : number * percentBase / 100 : number;
  return Number.isFinite(result) ? result : undefined;
}

/** Translate missing browser CSS semantics before the native engine parses styles. */
export function prepareHtmlElement(element: HtmlElement, viewport?: Viewport) {
  const ancestors: HtmlElement[] = [];
  for (let node: HtmlElement | undefined = element; node; ) {
    ancestors.unshift(node);
    const parent = node.parent as Partial<HtmlElement> | null;
    node = parent?.attribs ? parent as HtmlElement : undefined;
  }
  const variables: Record<string, string> = {};
  let fontSize = rootFontSize, lineHeight: { value: number; ratio: boolean } | undefined;
  let styles: Record<string, string> = {};
  let textShadow: string | undefined, whiteSpace: string | undefined;
  for (const node of ancestors) {
    let raw = originals.get(node);
    if (!raw) { raw = declarations(node.attribs.style ?? ""); originals.set(node, raw); }
    Object.entries(raw).forEach(([key, value]) => { if (key.startsWith("--")) variables[key] = value; });
    const resolved = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, key.startsWith("--") ? value : resolveVars(value, variables)]));
    const nextFont = length(resolveUnits(resolved["font-size"] ?? "", fontSize, viewport), fontSize, fontSize);
    if (nextFont !== undefined && nextFont > 0) fontSize = nextFont;
    textShadow = resolved["text-shadow"] ?? textShadow;
    whiteSpace = resolved["white-space"] ?? whiteSpace;
    const height = resolved["line-height"];
    if (height === "normal") lineHeight = { value: 1.2, ratio: true };
    else if (height && /^\d*\.?\d+$/.test(height)) lineHeight = { value: Number(height), ratio: true };
    else if (height) {
      const pixels = length(height, fontSize, fontSize);
      if (pixels !== undefined && pixels >= 0) lineHeight = { value: pixels, ratio: false };
    }
    if (node === element) styles = resolved;
  }
  if (textShadow) styles["text-shadow"] = textShadow;
  if (whiteSpace) styles["white-space"] = whiteSpace;
  if (styles["font-size"]) styles["font-size"] = `${fontSize}px`;
  if (lineHeight) styles["line-height"] = `${lineHeight.ratio ? fontSize * lineHeight.value : lineHeight.value}px`;
  if (styles["font-family"]) styles["font-family"] = styles["font-family"].replace(/\bsystem-ui\b/g, "sans-serif");
  const translated: Record<string, string> = {};
  for (const [key, raw] of Object.entries(styles)) {
    if (key.startsWith("--")) { translated[key] = raw; continue; }
    const value = resolveUnits(raw, fontSize, viewport);
    const side = /^border-(top|right|bottom|left)$/.exec(key)?.[1];
    if (side) {
      try {
        const border = getStylesForProperty("border", value);
        if (border.borderWidth !== undefined) translated[`border-${side}-width`] = `${border.borderWidth}px`;
        if (typeof border.borderColor === "string") translated[`border-${side}-color`] = border.borderColor;
        if (typeof border.borderStyle === "string") translated["border-style"] = border.borderStyle;
      } catch { /* Ignore unsupported border syntax. */ }
    } else translated[key] = value;
  }
  if (translated.display === "flex" && !translated["flex-direction"] && !translated["flex-flow"]) translated["flex-direction"] = "row";
  prepared.set(element.attribs, translated);
  element.attribs.style = Object.entries(translated).map(([key, value]) => `${key}:${value}`).join(";");
}

/** These properties are missing from the HTML engine's inline CSS registry. */
export function htmlNativeStyles(style: string, attributes?: Record<string, string>): ViewStyle & TextStyle {
  const css = (attributes ? prepared.get(attributes) : undefined) ?? declarations(style), native: ViewStyle & TextStyle = {};
  if (css.display === "flex") {
    const [row, column = row] = splitCss(css.gap ?? "", " ");
    for (const [property, value] of [["rowGap", css["row-gap"] ?? row], ["columnGap", css["column-gap"] ?? column]]) {
      if (!value) continue;
      const pixels = length(value);
      if (pixels !== undefined && pixels >= 0) Object.assign(native, getStylesForProperty(property, value));
    }
  }
  if (css.overflow === "hidden" || css.overflow === "visible") native.overflow = css.overflow;
  if (css["box-sizing"] === "border-box" || css["box-sizing"] === "content-box") native.boxSizing = css["box-sizing"];
  for (const [property, name] of [["textShadow", "text-shadow"], ["margin", "margin"], ["marginTop", "margin-top"], ["marginRight", "margin-right"], ["marginBottom", "margin-bottom"], ["marginLeft", "margin-left"], ["top", "top"], ["right", "right"], ["bottom", "bottom"], ["left", "left"]]) {
    if (!css[name]) continue;
    try { Object.assign(native, getStylesForProperty(property, css[name])); } catch { /* Unsupported values remain unrendered. */ }
  }
  if (css["box-shadow"] && css["box-shadow"] !== "none") {
    const shadows: BoxShadowValue[] = [];
    for (const value of splitCss(css["box-shadow"], ",")) {
      try {
        const shadow = getStylesForProperty("boxShadow", value), offset = shadow.shadowOffset;
        if (offset && typeof offset === "object" && typeof offset.width === "number" && typeof offset.height === "number" && typeof shadow.shadowRadius === "number" && typeof shadow.shadowColor === "string") {
          shadows.push({ offsetX: offset.width, offsetY: offset.height, blurRadius: shadow.shadowRadius, color: shadow.shadowColor });
        }
      } catch { /* Keep rendering content when a shadow form is unsupported. */ }
    }
    native.boxShadow = shadows;
  }
  return native;
}

export function htmlTextLayout(style: string, attributes?: Record<string, string>) {
  const css = (attributes ? prepared.get(attributes) : undefined) ?? declarations(style);
  return css["white-space"] === "nowrap"
    ? { numberOfLines: 1 as const, ellipsizeMode: css["text-overflow"] === "ellipsis" ? "tail" as const : "clip" as const } : {};
}
