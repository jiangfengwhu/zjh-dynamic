export type SharedLink = { kind: "post" | "application"; id: string };

/** Only public content links are accepted; links never execute or install an application. */
export function parseSharedLink(value: string): SharedLink | undefined {
  try {
    if (/(^|\/)\.{1,2}(\/|$)/.test(decodeURIComponent(value.split(/[?#]/)[0]))) return;
    const url = new URL(value);
    if (url.username || url.password || url.port) return;
    const path = url.protocol === "https:" && url.hostname === "zijinhua.297782.xyz"
      ? url.pathname
      : url.protocol === "zijinhua:" ? `/${url.hostname}${url.pathname}` : "";
    const post = path.match(/^\/posts\/([a-f0-9]{64})\/?$/);
    if (post) return { kind: "post", id: post[1] };
    const application = path.match(/^\/applications\/([a-z][a-z0-9-]{0,63})\/?$/);
    if (application) return { kind: "application", id: application[1] };
  } catch { /* Ignore malformed or unrelated URLs. */ }
}
