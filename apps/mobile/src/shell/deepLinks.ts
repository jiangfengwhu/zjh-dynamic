import { normalizeShareParams } from "../../../../packages/app-sdk/src/sharing";
import type { ShareParams } from "../../../../packages/app-sdk/src";
export type SharedLink = { kind: "post" | "application"; id: string; params?: ShareParams };

/** Public application links open the published application with validated parameters. */
export function parseSharedLink(value: string): SharedLink | undefined {
  if (value.length > 16384) return;
  // RN's built-in URL hostname/pathname getters only recognize HTTP URLs. Match the
  // small public-link grammar directly, without broad URL normalization.
  const match = value.match(/^(?:https:\/\/zijinhua\.297782\.xyz\/|zijinhua:\/\/)(posts|applications)\/([^/?#]+)\/?(?:[?#].*)?$/i);
  if (!match) return;
  if (match[1].toLowerCase() === "posts" && /^[a-f0-9]{64}$/.test(match[2])) return { kind: "post", id: match[2] };
  if (match[1].toLowerCase() === "applications" && /^[a-z][a-z0-9-]{0,63}$/.test(match[2])) {
    try {
      const query = value.split("?")[1]?.split("#")[0];
      const fields = new URLSearchParams(query ?? "");
      if (fields.getAll("p").length > 1) return;
      const params = fields.has("p") ? normalizeShareParams(JSON.parse(fields.get("p")!)) : undefined;
      return { kind: "application", id: match[2], ...(params ? { params } : {}) };
    } catch { return; }
  }
}

export function sharedLinkUrl(target: SharedLink) {
  const params = normalizeShareParams(target.params);
  return `https://zijinhua.297782.xyz/${target.kind === "post" ? "posts" : "applications"}/${target.id}${target.kind === "application" && params ? `?p=${encodeURIComponent(JSON.stringify(params)).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}` : ""}`;
}
