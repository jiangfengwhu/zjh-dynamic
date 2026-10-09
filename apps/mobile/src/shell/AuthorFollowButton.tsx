import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator } from "react-native";
import { Pressy } from "../../../../packages/ui/chrome";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { useTheme } from "../../../../packages/ui/theme";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { cachedAccountId, requireAccount, useAccount } from "./account";
import { afterInteractions } from "./interactionWork";
import { cachedAuthorFollowing, fetchAuthorProfile, setAuthorFollow, subscribeAuthorFollow } from "./feed/userPosts";
import { HostText as Text } from "./feed/HostText";

export function AuthorFollowButton({ authorId, compact = false, active = true }: { authorId: string; compact?: boolean; active?: boolean }) {
  const { colors: t } = useTheme();
  const { user } = useAccount();
  const owner = user?.id;
  const following = useSyncExternalStore(subscribeAuthorFollow, () => cachedAuthorFollowing(authorId));
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (!active || !owner || owner === authorId || cachedAuthorFollowing(authorId) !== undefined) return;
    return afterInteractions(() => { void fetchAuthorProfile(authorId).catch(() => {}); });
  }, [authorId, owner, active]);
  if (!authorId || owner === authorId) return null;
  async function follow() {
    if (pending.current) return;
    pending.current = true;
    try {
      if (!await requireAccount() || !alive.current || cachedAccountId() !== owner) return;
      setBusy(true);
      await setAuthorFollow(authorId, true);
    } catch (cause) {
      if (alive.current && cachedAccountId() === owner) Toast.show({ type: "error", text1: "关注未完成", text2: cause instanceof Error ? cause.message : "请重试" });
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return <Pressy accessibilityRole="button" accessibilityLabel={following ? "已关注作者" : "关注作者"} accessibilityState={{ disabled: busy || following === true }} disabled={busy || following === true} hitSlop={compact ? { top: 3, left: 3, bottom: 27, right: 27 } : 4} onPress={() => void follow()} style={compact
    ? { position: "absolute", right: -1, bottom: -1, width: 14, height: 14, minWidth: 14, minHeight: 14, padding: 0, borderRadius: t.radius.pill, borderWidth: 1, borderColor: t.canvas, backgroundColor: following ? t.surfaceRaised : t.accent, alignItems: "center", justifyContent: "center" }
    : { minHeight: 36, paddingHorizontal: 12, borderRadius: t.radius.pill, backgroundColor: following ? t.surfaceRaised : t.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }}>
    {busy && !compact ? <ActivityIndicator size="small" color={t.onAccent} /> : <SymbolIcon name={following ? "check" : "plus"} size={compact ? 10 : 15} color={following ? t.ink3 : t.onAccent} />}
    {!compact ? <Text style={{ color: following ? t.ink3 : t.onAccent, fontSize: 12, fontWeight: "700" }}>{following ? "已关注" : "关注"}</Text> : null}
  </Pressy>;
}
