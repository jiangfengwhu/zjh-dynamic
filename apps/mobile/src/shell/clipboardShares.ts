import Clipboard from "@react-native-clipboard/clipboard";
import { AppState } from "react-native";
import { parseSharedLink, type SharedLink } from "./deepLinks";
import { readShellValueSync, writeShellValue, removeShellValue } from "./shellStorage";

const lastOpenedKey = "share.clipboard.lastOpened";

export function createShareText(target: SharedLink, description: string): string {
  const path = target.kind === "post" ? "posts" : "applications";
  return `${description.slice(0, 1000)}\nhttps://zijinhua.297782.xyz/${path}/${target.id}\n复制这段内容，打开紫金花即可查看`;
}

export function parseClipboardShare(text: string): SharedLink | undefined {
  if (text.length > 16384) return;
  const targets = new Map<string, SharedLink>();
  for (const match of text.matchAll(/https:\/\/[^\s<>"'()[\]{}【】]+/gi)) {
    const url = match[0].replace(/[.,!?;:，。！？；：、）]+$/, "");
    const target = parseSharedLink(url);
    if (target) targets.set(`${target.kind}:${target.id}`, target);
  }
  if (targets.size === 1) return targets.values().next().value;
}

/** Deduplicate only the current clipboard; do not persist clipboard prose or block old links forever. */
function fingerprint(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${text.length}:${hash >>> 0}`;
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
        if (!share) { removeShellValue(lastOpenedKey); return; }
        const key = fingerprint(text.trim());
        if (directIntent || readShellValueSync(lastOpenedKey) === key) return;
        onLink(share);
        writeShellValue(lastOpenedKey, key);
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
