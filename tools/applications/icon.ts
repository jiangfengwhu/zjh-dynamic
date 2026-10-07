/** Icons are static, self-contained SVG resources, never executable documents. */
export function validateApplicationIcon(svg: string) {
  const text = svg.trim();
  if (new TextEncoder().encode(text).length > 65536 || !/^<svg\b/i.test(text) || !/<\/svg>$/i.test(text)) throw new Error("assets/icon.svg 必须是小于 64 KB 的 SVG");
  if (/<(?:script|foreignObject|image|style|animate\w*|set|iframe)\b|<!|&#|\b(?:[\w-]+:)?href\s*=|\bon\w+\s*=|@import/i.test(text)) throw new Error("应用图标只能包含静态 SVG，不可嵌入脚本、图片或外部资源");
  for (const value of text.matchAll(/url\s*\(([^)]*)\)/gi)) if (!/^\s*['"]?#[\w.-]+['"]?\s*$/.test(value[1])) throw new Error("应用图标只能引用自身的渐变与裁切路径");
  const viewBox = text.match(/^<svg\b[^>]*\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().split(/[\s,]+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2] <= 0 || viewBox[2] !== viewBox[3]) throw new Error("应用图标需要正方形 viewBox，例如 0 0 128 128");
}
