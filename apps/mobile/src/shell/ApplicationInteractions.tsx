import { memo, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import { SymbolIcon, type IconSymbol } from "../../../../packages/ui/chrome/SymbolIcon";
import { useTheme } from "../../../../packages/ui/theme";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { cachedAccountId, requireAccount } from "./account";
import { fetchApplicationComments, fetchApplicationDiscussion, saveApplicationDiscussion, togglePostLike, type UserPost } from "./feed/userPosts";
import type { MarketApplication } from "./market";
import { LikeGlyph } from "../../../../packages/ui/feed/kit/FeedActionBar";
import { afterInteractions } from "./interactionWork";

const cache = new Map<string, UserPost>();
const cacheAt = new Map<string, number>();
export async function readApplicationComments(appId: string) {
  const owner = cachedAccountId() ?? "guest";
  const key = `${owner}:${appId}`;
  const result = await fetchApplicationComments(appId);
  const post = result.post;
  if ((cachedAccountId() ?? "guest") === owner) {
    cache.set(key, post); cacheAt.set(key, Date.now());
    if (cache.size > 64) { const first = cache.keys().next().value!; cache.delete(first); cacheAt.delete(first); }
  }
  return result;
}
export function cachedApplicationDiscussion(item: MarketApplication) {
  const owner = cachedAccountId() ?? "guest";
  const key = `${owner}:${item.manifest.appId}`;
  return item.interactionOwner === owner && (item.interactionAt || 0) > (cacheAt.get(key) || 0) ? item.discussion : cache.get(key);
}
export const ApplicationInteractions = memo(function ApplicationInteractions({ item, active, onComment, onOpen, onShare, onDetail }: {
  item: MarketApplication; active: boolean; onComment: (post?: UserPost) => void; onOpen: () => void; onShare: () => void; onDetail: () => void;
}) {
  const { colors: t } = useTheme();
  const owner = cachedAccountId() ?? "guest";
  const key = `${owner}:${item.manifest.appId}`;
  const [post, setPost] = useState(() => cachedApplicationDiscussion(item));
  const [pendingLike, setPendingLike] = useState<boolean>();
  const [pendingSaved, setPendingSaved] = useState<boolean>();
  const likeWanted = useRef<boolean | undefined>(undefined);
  const savedWanted = useRef<boolean | undefined>(undefined);
  const liking = useRef(false);
  const current = useRef(post);
  const alive = useRef(true);
  const version = useRef(0);
  const reading = useRef<Promise<UserPost> | undefined>(undefined);
  const writing = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function remember(next: UserPost) {
    if (!alive.current || (cachedAccountId() ?? "guest") !== owner) return;
    current.current = next; setPost(next);
    cache.delete(key); cache.set(key, next); cacheAt.set(key, Date.now());
    if (cache.size > 64) { const first = cache.keys().next().value!; cache.delete(first); cacheAt.delete(first); }
  }
  useEffect(() => {
    if (item.discussion && item.interactionOwner === owner && (item.interactionAt || 0) > (cacheAt.get(key) || 0)) remember(item.discussion);
  }, [item.discussion, item.interactionAt, key]);
  function read() {
    if (reading.current) return reading.current;
    const before = version.current;
    const task = fetchApplicationDiscussion(item.manifest.appId).then(next => {
      if (before === version.current) remember(next);
      return current.current ?? next;
    }).finally(() => { if (reading.current === task) reading.current = undefined; });
    reading.current = task;
    return task;
  }
  useEffect(() => {
    if (active && (!item.discussion || item.interactionOwner !== owner || Date.now() - (item.interactionAt || 0) > 30000)) return afterInteractions(() => { void read().catch(() => {}); });
  }, [active]);
  function fail(cause: unknown) {
    if (alive.current) Toast.show({ type: "error", text1: "互动未完成", text2: cause instanceof Error ? cause.message : "请重试" });
  }
  const valid = () => alive.current && cachedAccountId() === owner;
  function like() {
    if (!cachedAccountId()) { void requireAccount(); return; }
    likeWanted.current = !(likeWanted.current ?? current.current?.liked ?? false);
    setPendingLike(likeWanted.current);
    if (!liking.current) void syncLike();
  }
  async function syncLike() {
    liking.current = true;
    try {
      if (!await requireAccount() || !valid()) return;
      let confirmed = current.current ?? await read();
      while (valid() && likeWanted.current !== undefined && likeWanted.current !== !!confirmed.liked) {
        version.current++;
        const result = togglePostLike(confirmed);
        remember(result.post);
        const settled = await result.settled;
        confirmed = settled.post;
        remember({ ...(current.current ?? confirmed), liked: confirmed.liked, likeCount: confirmed.likeCount });
        if (settled.error) throw settled.error;
      }
    } catch (cause) { fail(cause); }
    finally { liking.current = false; likeWanted.current = undefined; if (alive.current) setPendingLike(undefined); }
  }
  function bookmark() {
    if (!cachedAccountId()) { void requireAccount(); return; }
    savedWanted.current = !(savedWanted.current ?? current.current?.saved ?? false);
    setPendingSaved(savedWanted.current);
    if (!writing.current) void syncSaved();
  }
  async function syncSaved() {
    writing.current = true;
    try {
      if (!await requireAccount() || !valid()) return;
      let confirmed = current.current ?? await read();
      while (valid() && savedWanted.current !== undefined && savedWanted.current !== !!confirmed.saved) {
        const wanted = savedWanted.current;
        version.current++;
        const result = await saveApplicationDiscussion(confirmed.id, wanted);
        confirmed = { ...confirmed, saved: result.saved };
        remember({ ...(current.current ?? confirmed), saved: result.saved });
      }
    } catch (cause) { fail(cause); }
    finally { writing.current = false; savedWanted.current = undefined; if (alive.current) setPendingSaved(undefined); }
  }
  const liked = pendingLike ?? !!post?.liked;
  const saved = pendingSaved ?? !!post?.saved;
  function comment() { onComment(current.current); }
  const action = (icon: IconSymbol, label: string, onPress: () => void, selected = false, disabled = false) =>
    <Pressy accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1 }}>
      {icon === "heart" || icon === "heartOutline" ? <LikeGlyph identity={key} liked={selected} size={23} inactiveColor={t.ink1} />
        : icon === "bookmark" ? <BookmarkGlyph identity={key} selected={selected} />
        : <SymbolIcon name={icon} size={23} color={t.ink1} />}
    </Pressy>;
  return <View style={{ flexDirection: "row", alignItems: "center" }}>
    {action(liked ? "heart" : "heartOutline", liked ? "取消点赞" : "点赞", like, liked)}
    {action("chat", "评论", () => void comment())}
    {action("bookmark", saved ? "从常用移除" : "添加到常用", bookmark, saved)}
    <View style={{ flex: 1 }} />
    {action("open", "打开应用", onOpen, false, !active)}
    {action("share", "分享", onShare)}
    {action("info", "详情", onDetail)}
  </View>;
});

/** A short lift and settle on save; restored state and rollback remain still. */
function BookmarkGlyph({ identity, selected }: { identity: string; selected: boolean }) {
  const { colors: t } = useTheme();
  const previous = useRef({ identity, selected });
  const scale = useSharedValue(1);
  const lift = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(scale); cancelAnimation(lift);
    scale.value = 1; lift.value = 0;
    if (previous.current.identity === identity && selected && !previous.current.selected) {
      const timing = { easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
      scale.value = withSequence(ReduceMotion.System,
        withTiming(0.85, { ...timing, duration: 60 }),
        withTiming(1.18, { ...timing, duration: 130 }),
        withTiming(1, { ...timing, duration: 150 }));
      lift.value = withSequence(ReduceMotion.System,
        withTiming(-3, { ...timing, duration: 150 }),
        withTiming(0, { ...timing, duration: 190 }));
    }
    previous.current = { identity, selected };
    return () => { cancelAnimation(scale); cancelAnimation(lift); };
  }, [identity, selected, scale, lift]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }, { scale: scale.value }] }));
  return <Animated.View style={motion}><SymbolIcon name="bookmark" size={23} color={selected ? t.accent : t.ink1} strokeWidth={selected ? 2.3 : 1.7} /></Animated.View>;
}
