import Clipboard from "@react-native-clipboard/clipboard";
import { AppState } from "react-native";
import { parseSharedLink, type SharedLink } from "./deepLinks";
import { readShellValueSync, writeShellValue } from "./shellStorage";

// Previous records included outgoing shares that were never opened. Do not reuse them.
const historyKey = "share.clipboard.opened.v2";

export function createShareText(target: SharedLink, description: string): string {
  const path = target.kind === "post" ? "posts" : "applications";
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${description.slice(0, 1000)}\nhttps://zijinhua.297782.xyz/${path}/${target.id}\n【紫金花口令:zijinhua://${path}/${target.id}#${nonce}】\n复制这段内容，打开紫金花即可查看`;
}

export function parseClipboardShare(text: string): { token: string; target: SharedLink } | undefined {
  if (text.length > 16384) return;
  const matches = [...text.matchAll(/【紫金花口令:(zijinhua:\/\/(?:posts|applications)\/[^\s【】]+)】/g)];
  if (matches.length !== 1) return;
  const token = matches[0][1];
  if (!/#[a-z0-9]{8,40}$/.test(token)) return;
  const target = parseSharedLink(token);
  if (target) return { token, target };
}

function consumedTokens(): string[] {
  try {
    const value: unknown = JSON.parse(readShellValueSync(historyKey) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(-32) : [];
  } catch { return []; }
}

function consumeShareText(text: string) {
  const share = parseClipboardShare(text);
  if (share) writeShellValue(historyKey, JSON.stringify([...consumedTokens().filter(token => token !== share.token), share.token].slice(-32)));
}

export function copyShareText(text: string) {
  Clipboard.setString(text);
}

/** One read per foreground entry; never polls, clears the clipboard or makes network requests. */
export function watchClipboardShares(onLink: (target: SharedLink) => void) {
  let live = true;
  let started = false;
  let directIntent = false;
  let revision = 0;
  let state = AppState.currentState;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function schedule() {
    clearTimeout(timer);
    const generation = ++revision;
    timer = setTimeout(() => {
      if (!live || AppState.currentState !== "active") return;
      void Clipboard.getString().then(text => {
        if (!live || generation !== revision || AppState.currentState !== "active") return;
        const share = parseClipboardShare(text);
        if (!share || directIntent || consumedTokens().includes(share.token)) return;
        onLink(share.target);
        consumeShareText(text);
      }).catch(() => {});
    }, 400);
  }
  const subscription = AppState.addEventListener("change", next => {
    const previous = state;
    state = next;
    if (next !== "active") {
      ++revision;
      clearTimeout(timer);
      if (previous === "active") directIntent = false;
    } else if (previous !== "active" && started) schedule();
  });
  return {
    start() { started = true; if (AppState.currentState === "active") schedule(); },
    directLinkReceived() { directIntent = true; },
    stop() { live = false; ++revision; clearTimeout(timer); subscription.remove(); },
  };
}
