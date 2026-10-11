import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  // Reuse the native buttons across pages, but keep every in-flight operation
  // attached to its own application. Late responses cannot update the next row.
  const scope = useMemo(() => ({
    post: cachedApplicationDiscussion(item), alive: false, version: 0,
    likeWanted: undefined as boolean | undefined, savedWanted: undefined as boolean | undefined,
    liking: false, writing: false, reading: undefined as Promise<UserPost> | undefined,
  }), [key]);
  const currentScope = useRef(scope);
  useLayoutEffect(() => {
    currentScope.current = scope;
    scope.alive = true;
    return () => { scope.alive = false; };
  }, [scope]);
  const [state, setState] = useState(() => ({ scope, post: scope.post, pendingLike: undefined as boolean | undefined, pendingSaved: undefined as boolean | undefined }));
  if (state.scope !== scope) setState({ scope, post: scope.post, pendingLike: undefined, pendingSaved: undefined });
  const post = state.scope === scope ? state.post : scope.post;
  const pendingLike = state.scope === scope ? state.pendingLike : undefined;
  const pendingSaved = state.scope === scope ? state.pendingSaved : undefined;
  const validScope = () => scope.alive && currentScope.current === scope && (cachedAccountId() ?? "guest") === owner;
  function setPendingLike(value: boolean | undefined) { setState(prior => prior.scope === scope ? { ...prior, pendingLike: value } : prior); }
  function setPendingSaved(value: boolean | undefined) { setState(prior => prior.scope === scope ? { ...prior, pendingSaved: value } : prior); }
  function remember(next: UserPost) {
    if (!validScope()) return;
    scope.post = next; setState(prior => prior.scope === scope ? { ...prior, post: next } : prior);
    cache.delete(key); cache.set(key, next); cacheAt.set(key, Date.now());
    if (cache.size > 64) { const first = cache.keys().next().value!; cache.delete(first); cacheAt.delete(first); }
  }
  useEffect(() => {
    if (item.discussion && item.interactionOwner === owner && (item.interactionAt || 0) > (cacheAt.get(key) || 0)) remember(item.discussion);
  }, [item.discussion, item.interactionAt, scope]);
  function read() {
    if (scope.reading) return scope.reading;
    const before = scope.version;
    const task = fetchApplicationDiscussion(item.manifest.appId).then(next => {
      if (before === scope.version) remember(next);
      return scope.post ?? next;
    }).finally(() => { if (scope.reading === task) scope.reading = undefined; });
    scope.reading = task;
    return task;
  }
  useEffect(() => {
    if (active && (!item.discussion || item.interactionOwner !== owner || Date.now() - (item.interactionAt || 0) > 30000)) return afterInteractions(() => { void read().catch(() => {}); });
  }, [active, scope]);
  function fail(cause: unknown) {
    if (validScope()) Toast.show({ type: "error", text1: "互动未完成", text2: cause instanceof Error ? cause.message : "请重试" });
  }
  const valid = () => validScope() && cachedAccountId() === owner;
  function like() {
    if (!cachedAccountId()) { void requireAccount(); return; }
    scope.likeWanted = !(scope.likeWanted ?? scope.post?.liked ?? false);
    setPendingLike(scope.likeWanted);
    if (!scope.liking) void syncLike();
  }
  async function syncLike() {
    scope.liking = true;
    try {
      if (!await requireAccount() || !valid()) return;
      let confirmed = scope.post ?? await read();
      while (valid() && scope.likeWanted !== undefined && scope.likeWanted !== !!confirmed.liked) {
        scope.version++;
        const result = togglePostLike(confirmed);
        remember(result.post);
        const settled = await result.settled;
        confirmed = settled.post;
        remember({ ...(scope.post ?? confirmed), liked: confirmed.liked, likeCount: confirmed.likeCount });
        if (settled.error) throw settled.error;
      }
    } catch (cause) { fail(cause); }
    finally { scope.liking = false; scope.likeWanted = undefined; if (validScope()) setPendingLike(undefined); }
  }
  function bookmark() {
    if (!cachedAccountId()) { void requireAccount(); return; }
    scope.savedWanted = !(scope.savedWanted ?? scope.post?.saved ?? false);
    setPendingSaved(scope.savedWanted);
    if (!scope.writing) void syncSaved();
  }
  async function syncSaved() {
    scope.writing = true;
    try {
      if (!await requireAccount() || !valid()) return;
      let confirmed = scope.post ?? await read();
      while (valid() && scope.savedWanted !== undefined && scope.savedWanted !== !!confirmed.saved) {
        const wanted = scope.savedWanted;
        scope.version++;
        const result = await saveApplicationDiscussion(confirmed.id, wanted);
        confirmed = { ...confirmed, saved: result.saved };
        remember({ ...(scope.post ?? confirmed), saved: result.saved });
      }
    } catch (cause) { fail(cause); }
    finally { scope.writing = false; scope.savedWanted = undefined; if (validScope()) setPendingSaved(undefined); }
  }
  const liked = pendingLike ?? !!post?.liked;
  const saved = pendingSaved ?? !!post?.saved;
  function comment() { onComment(scope.post); }
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
