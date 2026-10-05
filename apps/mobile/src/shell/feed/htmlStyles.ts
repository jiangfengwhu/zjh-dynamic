type HtmlElement = { attribs: Record<string, string>; parent: unknown };

function declarations(style: string) {
  const result: Record<string, string> = {};
  for (const entry of style.split(";")) {
    const colon = entry.indexOf(":");
    if (colon < 0) continue;
    const name = entry.slice(0, colon).trim().toLowerCase();
    result[name] = entry.slice(colon + 1).replace(/\s*!important\s*$/i, "").trim();
  }
  return result;
}

/** Translate browser defaults the native HTML engine does not implement. */
export function prepareHtmlElement(element: HtmlElement) {
  const styles = declarations(element.attribs.style ?? "");
  if (styles.display === "flex" && !styles["flex-direction"]) styles["flex-direction"] = "row";
  let fontSize = 15;
  let lineHeight: string | undefined;
  let foundFont = false;
  for (let node: HtmlElement | undefined = element; node; ) {
    const inherited = node === element ? styles : declarations(node.attribs.style ?? "");
    if (!foundFont && /^\d+(?:\.\d+)?px$/.test(inherited["font-size"] ?? "")) {
      fontSize = parseFloat(inherited["font-size"]); foundFont = true;
    }
    lineHeight ??= inherited["line-height"];
    const parent = node.parent as Partial<HtmlElement> | null;
    node = parent?.attribs ? parent as HtmlElement : undefined;
  }
  if (lineHeight && /^[1-3](?:\.\d{1,2})?$/.test(lineHeight)) styles["line-height"] = `${fontSize * Number(lineHeight)}px`;
  element.attribs.style = Object.entries(styles).map(([key, value]) => `${key}:${value}`).join(";");
}

/** Gap is absent from the HTML engine's CSS registry; apply it to native blocks. */
export function htmlNativeStyles(style: string) {
  const styles = declarations(style);
  return styles.display === "flex" && /^\d{1,2}(?:px)?$/.test(styles.gap ?? "") && parseFloat(styles.gap) <= 49
    ? { gap: parseFloat(styles.gap) } : {};
}
