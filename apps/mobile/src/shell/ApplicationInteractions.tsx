import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import { SymbolIcon, type IconSymbol } from "../../../../packages/ui/chrome/SymbolIcon";
import { useTheme } from "../../../../packages/ui/theme";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { cachedAccountId, requireAccount } from "./account";
import { fetchApplicationDiscussion, saveApplicationDiscussion, togglePostLike, type UserPost } from "./feed/userPosts";
import type { MarketApplication } from "./market";
import { LikeGlyph } from "../../../../packages/ui/feed/kit/FeedActionBar";
import { afterInteractions } from "./interactionWork";

const cache = new Map<string, UserPost>();
export function ApplicationInteractions({ item, active, onComment, onShare, onDetail }: {
  item: MarketApplication; active: boolean; onComment: (post: UserPost) => void; onShare: () => void; onDetail: () => void;
}) {
  const { colors: t } = useTheme();
  const owner = cachedAccountId() ?? "guest";
  const key = `${owner}:${item.manifest.appId}`;
  const [post, setPost] = useState(() => cache.get(key));
  const [saving, setSaving] = useState(false);
  const current = useRef(post);
  const alive = useRef(true);
  const version = useRef(0);
  const reading = useRef<Promise<UserPost> | undefined>(undefined);
  const writing = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  function remember(next: UserPost) {
    if (!alive.current || (cachedAccountId() ?? "guest") !== owner) return;
    current.current = next; setPost(next);
    cache.delete(key); cache.set(key, next);
    if (cache.size > 64) cache.delete(cache.keys().next().value!);
  }
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
    if (active) return afterInteractions(() => { void read().catch(() => {}); });
  }, [active]);
  function fail(cause: unknown) {
    if (alive.current) Toast.show({ type: "error", text1: "互动未完成", text2: cause instanceof Error ? cause.message : "请重试" });
  }
  async function like() {
    try {
      if (!await requireAccount() || !alive.current) return;
      const original = current.current ?? await read();
      if (!alive.current) return;
      version.current++;
      const result = togglePostLike(original);
      remember(result.post);
      const settled = await result.settled;
      remember({ ...(current.current ?? settled.post), liked: settled.post.liked, likeCount: settled.post.likeCount });
      if (settled.error) fail(settled.error);
    } catch (cause) { fail(cause); }
  }
  async function bookmark() {
    if (writing.current) return;
    writing.current = true;
    try {
      if (!await requireAccount() || !alive.current) return;
      const original = current.current ?? await read();
      if (!alive.current) return;
      version.current++; setSaving(true);
      remember({ ...original, saved: !original.saved });
      try {
        const result = await saveApplicationDiscussion(original.id, !original.saved);
        remember({ ...(current.current ?? original), saved: result.saved });
      } catch (cause) { remember({ ...(current.current ?? original), saved: original.saved }); throw cause; }
    } catch (cause) { fail(cause); }
    finally { writing.current = false; if (alive.current) setSaving(false); }
  }
  async function comment() {
    try {
      const value = current.current ?? await read();
      if (alive.current) onComment(value);
    } catch (cause) { fail(cause); }
  }
  const action = (icon: IconSymbol, label: string, onPress: () => void, selected = false, disabled = false) =>
    <Pressy accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.5 : 1 }}>
      {icon === "heart" || icon === "heartOutline" ? <LikeGlyph identity={`${key}:${post?.id ?? "pending"}`} liked={selected} size={23} inactiveColor={t.ink1} />
        : icon === "bookmark" ? <BookmarkGlyph identity={`${key}:${post?.id ?? "pending"}`} selected={selected} />
        : <SymbolIcon name={icon} size={23} color={t.ink1} />}
    </Pressy>;
  return <View style={{ flexDirection: "row", alignItems: "center" }}>
    {action(post?.liked ? "heart" : "heartOutline", post?.liked ? "取消点赞" : "点赞", () => void like(), !!post?.liked)}
    {action("chat", "评论", () => void comment())}
    {action("bookmark", post?.saved ? "取消收藏" : "收藏", () => void bookmark(), !!post?.saved, saving)}
    <View style={{ flex: 1 }} />
    {action("share", "分享", onShare)}
    {action("info", "详情", onDetail)}
  </View>;
}

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
