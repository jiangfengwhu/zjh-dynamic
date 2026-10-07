export type SharedLink = { kind: "post" | "application"; id: string };

/** Only public content links are accepted; links never execute or install an application. */
export function parseSharedLink(value: string): SharedLink | undefined {
  // RN's built-in URL hostname/pathname getters only recognize HTTP URLs. Match the
  // small public-link grammar directly, without broad URL normalization.
  const match = value.match(/^(?:https:\/\/zijinhua\.297782\.xyz\/|zijinhua:\/\/)(posts|applications)\/([^/?#]+)\/?(?:[?#].*)?$/i);
  if (!match) return;
  if (match[1].toLowerCase() === "posts" && /^[a-f0-9]{64}$/.test(match[2])) return { kind: "post", id: match[2] };
  if (match[1].toLowerCase() === "applications" && /^[a-z][a-z0-9-]{0,63}$/.test(match[2])) return { kind: "application", id: match[2] };
}
