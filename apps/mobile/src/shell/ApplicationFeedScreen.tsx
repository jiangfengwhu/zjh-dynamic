import { Activity, memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, BackHandler, Keyboard, View, type LayoutChangeEvent } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { SafeAreaFrameContext, SafeAreaInsetsContext, SafeAreaProvider } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { cancelAnimation, Easing, ReduceMotion, runOnJS, runOnUI, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming, type AnimatedRef } from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { ThemeContext, useTheme } from "../../../../packages/ui/theme";
import { Skeleton } from "../../../../packages/ui/feedback/Skeleton";
import { afterInteractions, beginRouteTransition, endRouteTransition } from "./interactionWork";
import { ApplicationIcon } from "./ApplicationIcon";
import { UserAvatar } from "./UserAvatar";
import { HostText as Text } from "./feed/HostText";
import { useAccount } from "./account";
import { useProfileDrawer } from "./ProfileDrawer";
import { bindApplicationExperienceBack, bindNextApplication } from "./applicationExperienceNavigation";
import { EXPERIENCE_AHEAD, experienceId, useApplicationExperienceQueue } from "./useApplicationExperienceQueue";
import { ApplicationInteractions } from "./ApplicationInteractions";
import type { UserPost } from "./feed/userPosts";
import { ApplicationCommentsSheet } from "./ApplicationCommentsSheet";
import { fetchMarketPage, type MarketApplication, type MarketPage } from "./market";

type Props = {
  renderApplication: (id: string, onBack: () => void) => ReactNode;
  onProfile: () => void;
  onSearch: () => void;
  onOpen: (id: string) => Promise<boolean>;
  active?: boolean;
  stageRef: AnimatedRef<View>;
  onDetail: (item: MarketApplication) => void;
  onShare: (item: MarketApplication) => void;
  onRemix: (item: MarketApplication) => void;
  onAuthor: (author: { id: string; name: string; avatarUrl: string | null; official?: boolean }) => void;
};
const timing = { duration: 200, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
const SWITCH_INTERACTION = "application-feed-switch";
const unique = (items: MarketApplication[]) => [...new Map(items.map(item => [item.manifest.appId, item])).values()];

/** Only the lower switching surface owns paging; the native app stage owns its touches. */
export function ApplicationFeedScreen(props: Props) {
  const appTheme = useTheme();
  const theme = appTheme;
  const t = theme.colors;
  const focused = useIsFocused() && (props.active ?? true);
  const { user } = useAccount();
  const identity = user?.id ?? "guest";
  const { progress } = useProfileDrawer();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [page, setPage] = useState<MarketPage & { owner: string; loaded: boolean }>({ owner: identity, applications: [], loaded: false });
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [commentPost, setCommentPost] = useState<UserPost | null>(null);
  const [switching, setSwitching] = useState(false);
  const pausedRef = useRef(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [height, setHeight] = useState(1);
  const [width, setWidth] = useState(1);
  const [spacing, setSpacing] = useState({ width: 1, height: 1 });
  const generation = useRef(0);
  const request = useRef(false);
  const currentOwner = useRef(identity);
  currentOwner.current = identity;
  const items = page.owner === identity ? page.applications : [];
  const item = items[index];
  const previous = items[index - 1];
  const next = items[index + 1];
  const active = focused && foreground && !drawerOpen;
  const drag = useSharedValue(0);
  const moving = useSharedValue(false);
  const dragging = useSharedValue(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  useAnimatedReaction(() => progress.value > 0.001, (open, prior) => {
    if (open !== prior) runOnJS(setDrawerOpen)(open);
  }, [progress]);

  const setPause = useCallback((value: boolean) => { pausedRef.current = value; setPaused(value); }, []);
  const pauseExperience = useCallback(() => setPause(true), [setPause]);
  const resumeExperience = useCallback(() => setPause(false), [setPause]);
  useEffect(() => {
    if (!switching) return;
    beginRouteTransition(SWITCH_INTERACTION);
    return () => endRouteTransition(SWITCH_INTERACTION);
  }, [switching]);
  useFocusEffect(useCallback(() => {
    if (!focused) return;
    const leave = () => {
      if (!item || pausedRef.current) return false;
      Keyboard.dismiss();
      setPause(true);
      return true;
    };
    const unbind = bindApplicationExperienceBack(leave);
    const back = BackHandler.addEventListener("hardwareBackPress", leave);
    return () => { unbind(); back.remove(); };
  }, [focused, item?.manifest.appId, setPause]));

  const load = useCallback(async (more = false) => {
    if (request.current || (more && !page.nextCursor)) return;
    request.current = true;
    const token = generation.current;
    const owner = identity;
    const cursor = more ? page.nextCursor : undefined;
    setBusy(true);
    setError("");
    try {
      const result = await fetchMarketPage("", "", cursor);
      if (generation.current !== token || currentOwner.current !== owner) return;
      setPage(prior => ({ owner, loaded: true, applications: unique(more && prior.owner === owner ? [...prior.applications, ...result.applications] : result.applications), nextCursor: result.nextCursor === cursor ? undefined : result.nextCursor }));
      if (!more) { setIndex(0); setPause(false); setRevision(value => value + 1); }
      return result.applications.length > 0;
    } catch (cause) {
      if (generation.current === token && currentOwner.current === owner) setError(cause instanceof Error ? cause.message : "作品暂时未能加载");
    } finally {
      if (generation.current === token) { request.current = false; setBusy(false); }
    }
  }, [identity, page.nextCursor, setPause]);
  useEffect(() => {
    generation.current++;
    request.current = false;
    setPage({ owner: identity, applications: [], loaded: false });
    setIndex(0);
    setPause(false);
    setError("");
    setBusy(false);
    return () => { generation.current++; };
  }, [identity, setPause]);
  useEffect(() => {
    if (active && page.owner === identity && !page.loaded && !request.current && !error) void load();
  }, [active, page.owner, page.loaded, identity, error, load]);
  useEffect(() => {
    if (active && page.loaded && page.nextCursor && items.length - index <= EXPERIENCE_AHEAD + 4 && !busy && !error) void load(true);
  }, [active, page.loaded, page.nextCursor, items.length, index, busy, error, load]);

  const startSwitch = useCallback(() => {
    beginRouteTransition(SWITCH_INTERACTION);
    setSwitching(true);
  }, []);
  const commit = useCallback((direction: number) => {
    Keyboard.dismiss();
    setIndex(value => Math.max(0, Math.min(items.length - 1, value + direction)));
    setPause(false);
  }, [items.length, setPause]);
  useLayoutEffect(() => {
    cancelAnimation(drag);
    drag.value = 0;
    moving.value = false;
    setSwitching(false);
  }, [identity, revision, active, drag, moving]);
  useLayoutEffect(() => {
    moving.value = false;
    setSwitching(false);
  }, [index, moving]);
  const finish = useCallback((direction: number) => {
    "worklet";
    if (moving.value) return;
    if (direction > 0 ? !next : !previous) return;
    moving.value = true;
    runOnJS(startSwitch)();
    drag.value = withTiming(-direction * spacing.height, timing, done => {
      if (done) runOnJS(commit)(direction);
      else { moving.value = false; runOnJS(setSwitching)(false); }
    });
  }, [next, previous, spacing.height, commit, drag, moving, startSwitch]);
  const swipe = useMemo(() => Gesture.Pan()
    .enabled(active && !commentPost && Boolean(item))
    .maxPointers(1)
    .activeOffsetY([-8, 8])
    .failOffsetX([-25, 25])
    .onStart(() => { dragging.value = true; runOnJS(startSwitch)(); })
    .onUpdate(event => {
      if (moving.value) return;
      const direction = event.translationY < 0 ? 1 : -1;
      const available = direction > 0 ? Boolean(next) : Boolean(previous);
      drag.value = Math.max(-height, Math.min(height, event.translationY * (available ? 1 : 0.15)));
    })
    .onEnd(event => {
      if (moving.value) return;
      const distance = event.translationY;
      if (Math.abs(distance) > 48 || Math.abs(event.velocityY) > 550) finish(distance < 0 ? 1 : -1);
    })
    .onFinalize(() => {
      if (!dragging.value) return;
      dragging.value = false;
      if (!moving.value) {
        moving.value = true;
        drag.value = withTiming(0, timing, () => { moving.value = false; runOnJS(setSwitching)(false); });
      }
    }),
    [active, commentPost, item, next, previous, height, finish, moving, dragging, drag, startSwitch]);
  const advance = useCallback(() => {
    if (next) finish(1);
    else if (!busy && page.nextCursor) {
      const owner = identity;
      void load(true).then(added => { if (added && currentOwner.current === owner) { setIndex(value => value === index ? value + 1 : value); setPause(false); } });
    } else if (!busy) void load();
  }, [next, finish, busy, load, page.nextCursor, identity, index, setPause]);
  useFocusEffect(useCallback(() => focused ? bindNextApplication(advance) : undefined, [focused, advance]));
  const layout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setHeight(Math.max(1, height));
    setWidth(Math.max(1, width));
    // IME animation resizes app content, never the absolute page coordinates.
    setSpacing(prior => prior.width === width && prior.height >= height ? prior : { width, height: Math.max(1, height) });
  };

  return <ThemeContext.Provider value={theme}>
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <Animated.View ref={props.stageRef} collapsable={false} style={{ flex: 1, marginHorizontal: 4, borderRadius: t.radius.xxl, overflow: "hidden", backgroundColor: appTheme.colors.canvas }} onLayout={layout}>
        {item && height > 1 && width > 1 ? <ExperienceQueue key={`${identity}:${revision}`} items={items} index={index} active={active} foreground={foreground && !drawerOpen} switching={switching} paused={paused} width={width} height={height} spacing={spacing.height} drag={drag} render={props.renderApplication} onPause={pauseExperience} onResume={resumeExperience} onDetail={props.onDetail} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 16 }}>
            {!page.loaded && !error ? <ExperienceSkeleton /> : <><Text style={{ color: appTheme.colors.ink1, fontSize: 17, fontWeight: "700" }}>{error ? "作品暂时未能加载" : "还没有公开作品"}</Text><Text style={{ color: appTheme.colors.ink3, textAlign: "center", lineHeight: 21 }}>{error || "先去创作一个，让大家刷到你的想法。"}</Text><Pressy accessibilityRole="button" onPress={() => void load()} style={{ padding: 14 }}><Text style={{ color: appTheme.colors.accentText }}>重新加载</Text></Pressy></>}
          </View>}
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", inset: 0, zIndex: 3, borderWidth: 1, borderColor: t.lineStrong, borderRadius: t.radius.xxl }} />
      </Animated.View>
      <GestureDetector gesture={swipe}>
        <View collapsable={false} accessibilityLabel="底部互动区，上下滑动切换作品，也可点击底部下一个箭头" style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 4 }}>
          {!item && (page.owner !== identity || (!page.loaded && !error)) ? <DiscoveryFooterSkeleton animated={active} /> : null}
          {item ? <ApplicationInteractions key={`${identity}:${item.manifest.appId}`} item={item} active={active && !switching} onComment={setCommentPost} onOpen={() => { void props.onOpen(item.manifest.appId); }} onShare={() => props.onShare(item)} onDetail={() => props.onDetail(item)} /> : null}
          {item ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressy accessibilityRole="button" accessibilityLabel={`查看作者${item.authorName}`} disabled={!item.authorId} onPress={() => item.authorId && props.onAuthor({ id: item.authorId, name: item.authorName, avatarUrl: item.authorAvatarUrl ?? null, official: item.authorOfficial })} style={{ flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <UserAvatar uri={item.authorAvatarUrl} size={32} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text numberOfLines={1} style={{ color: t.ink1, fontSize: 13, lineHeight: 18 }}><Text style={{ fontWeight: "700" }}>{item.authorName || "创作者"}</Text> · {item.title || item.manifest.appName}</Text>
                {item.summary || item.manifest.description ? <Text numberOfLines={1} ellipsizeMode="tail" style={{ color: t.ink3, fontSize: 11, lineHeight: 16 }}>{(item.summary || item.manifest.description).replace(/\s+/g, " ").trim()}</Text> : null}
              </View>
            </Pressy>
            <Pressy accessibilityRole="button" accessibilityLabel="改编这个作品" hitSlop={6} onPress={() => props.onRemix(item)} style={{ minHeight: 32, paddingHorizontal: 10, borderRadius: t.radius.pill, backgroundColor: t.surfaceRaised, flexDirection: "row", alignItems: "center", gap: 4 }}><SymbolIcon name="layers" size={14} color={t.ink1} /><Text style={{ color: t.ink1, fontSize: 12, fontWeight: "700" }}>改编</Text></Pressy>
          </View> : null}

        </View>
      </GestureDetector>
      {commentPost ? <ApplicationCommentsSheet key={`${identity}:${commentPost.id}`} post={commentPost} active={active} onDismiss={() => setCommentPost(null)} /> : null}
    </View>
  </ThemeContext.Provider>;
}

type QueueProps = {
  items: MarketApplication[]; index: number; active: boolean; foreground: boolean; switching: boolean; paused: boolean;
  width: number; height: number; spacing: number; drag: ReturnType<typeof useSharedValue<number>>;
  render: Props["renderApplication"]; onPause: () => void; onResume: () => void; onDetail: Props["onDetail"];
};
function ExperienceQueue(props: QueueProps) {
  const { entries, preparations, retry } = useApplicationExperienceQueue(props.items, props.index, props.active, props.active && !props.switching);
  const current = props.items[props.index];
  const positions = useMemo(() => new Map(props.items.map((item, index) => [experienceId(item), index])), [props.items]);
  const { height, drag } = props;
  const metrics = useMemo(() => ({ frame: { x: 0, y: 0, width: props.width, height }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }), [props.width, height]);
  const origin = useSharedValue(0);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value - origin.value }] }));
  const syncPosition = useCallback(() => {
    runOnUI((offset: number) => {
      // The completed drag and the new origin represent the same visual offset.
      // One transform owns the whole motion; no native scroll rebase can race it.
      cancelAnimation(drag);
      origin.value = offset;
      drag.value = 0;
    })(Math.max(0, props.index * props.spacing));
  }, [props.spacing, props.index, drag, origin]);
  useLayoutEffect(syncPosition, [syncPosition]);
  // This is a bounded seven-page stage, rather than an independently scrolling
  // list. Stable absolute positions preserve app instances and native hit testing.
  // Native SafeAreaView descendants need a provider, but it must stay outside
  // the moving list: providers emit frame/inset events on every translated frame.
  return <SafeAreaProvider style={{ flex: 1 }} initialMetrics={metrics}><Animated.View pointerEvents="box-none" style={[{ position: "absolute", top: 0, left: 0, width: props.width, height: props.items.length * props.spacing }, motion]}>
    {entries.map(item => {
      const index = positions.get(experienceId(item))!;
      const offset = index - props.index;
      const selected = experienceId(item) === experienceId(current);
      const nearby = Math.abs(offset) <= 1;
      return <View key={experienceId(item)} pointerEvents="box-none" style={{ position: "absolute", top: index * props.spacing, left: 0, width: props.width, height }}><CachedExperience item={item} selected={selected}
        ready={preparations.get(experienceId(item))?.ready ?? false} error={preparations.get(experienceId(item))?.error ?? ""} onRetry={retry}
        interactive={selected && props.active && !props.switching}
        accessible={selected && props.active}
        visible={props.active && !props.paused && nearby}
        paused={selected && props.paused} foreground={props.foreground}
        width={props.width} height={height} render={props.render}
        onPause={props.onPause} onResume={props.onResume} onDetail={props.onDetail} /></View>;
    })}</Animated.View></SafeAreaProvider>;
}
type CachedExperienceProps = Omit<QueueProps, "items" | "index" | "active" | "switching" | "drag" | "spacing"> & {
  item: MarketApplication; selected: boolean; ready: boolean; error: string; onRetry: (key: string) => void;
  interactive: boolean; accessible: boolean; visible: boolean;
};
const CachedExperience = memo(function CachedExperience({ item, selected, ready, error, onRetry, ...props }: CachedExperienceProps) {
  const { colors: t } = useTheme();
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const pause = useCallback(() => { if (selectedRef.current) props.onPause(); }, [props.onPause]);
  const detail = useCallback(() => props.onDetail(item), [props.onDetail, item]);
  const retry = useCallback(() => onRetry(experienceId(item)), [onRetry, item.manifest.appId, item.manifest.releaseId]);
  const metrics = useMemo(() => ({ frame: { x: 0, y: 0, width: props.width, height: props.height }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }), [props.width, props.height]);
  return <View pointerEvents={props.interactive ? "auto" : "none"} accessibilityElementsHidden={!props.accessible} importantForAccessibility={props.accessible ? "auto" : "no-hide-descendants"} style={{ height: props.height, width: props.width, overflow: "hidden", backgroundColor: t.canvas }}>
    <SafeAreaFrameContext.Provider value={metrics.frame}><SafeAreaInsetsContext.Provider value={metrics.insets}>
      <InlineExperience ready={ready} error={error} selected={selected} foreground={props.foreground} visible={props.visible} render={props.render} appId={item.manifest.appId} onRetry={retry} onPause={pause} onDetail={detail} />
      {props.paused ? <View style={{ position: "absolute", inset: 0 }}><ExperiencePlaceholder item={item} onResume={props.onResume} /></View> : null}
    </SafeAreaInsetsContext.Provider></SafeAreaFrameContext.Provider>
  </View>;
});

const InlineExperience = memo(function InlineExperience({ appId, ready, error, selected, foreground, visible, render, onRetry, onPause, onDetail }: { appId: string; ready: boolean; error: string; selected: boolean; foreground: boolean; visible: boolean; render: Props["renderApplication"]; onRetry: () => void; onPause: () => void; onDetail: () => void }) {
  const { colors: t } = useTheme();
  const showing = foreground && visible;
  const [retainedVisible, setRetainedVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!ready || !showing) { setRetainedVisible(false); return; }
    if (selected) { setMounted(true); return; }
    // Only activating a neighbour may wait for idle. The `showing` gate below
    // suspends departed pages immediately, even during uninterrupted swiping.
    return afterInteractions(() => startTransition(() => { setMounted(true); setRetainedVisible(true); }));
  }, [ready, showing, selected]);
  const content = useMemo(() => render(appId, onPause), [render, appId, onPause]);
  if (ready) {
    // Activity hides effects, but still renders an initially hidden tree. Do not
    // create distant, unvisited pages every time the forward window advances.
    // Once previewed, keep the tree and its state until the cache evicts it.
    if (!mounted && !selected) return null;
    return <Activity mode={showing && (selected || retainedVisible) ? "visible" : "hidden"}><View style={{ flex: 1 }}>{content}</View></Activity>;
  }
  // Resources warm independently; only the current page needs a loading animation.
  if (!selected || !visible) return null;
  return <View style={{ flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 }}>
    {error ? <><SymbolIcon name="alert" size={28} color={t.orange} /><Text style={{ color: t.ink1, fontSize: 17, fontWeight: "700" }}>暂时无法体验</Text><Text style={{ color: t.ink3, lineHeight: 21, textAlign: "center" }}>{error}</Text><View style={{ flexDirection: "row", gap: 20 }}><Pressy accessibilityRole="button" onPress={onRetry} style={{ padding: 14 }}><Text style={{ color: t.accentText }}>重试</Text></Pressy><Pressy accessibilityRole="button" onPress={onDetail} style={{ padding: 14 }}><Text style={{ color: t.accentText }}>查看详情</Text></Pressy></View></> : <><ExperienceSkeleton /><Text accessibilityLiveRegion="polite" style={{ color: t.ink3, fontSize: 13 }}>正在准备真实应用…</Text></>}
  </View>;
});

function DiscoveryFooterSkeleton({ animated }: { animated: boolean }) {
  const { colors: t } = useTheme();
  const action = (key: string) => <View key={key} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><Skeleton animated={animated} width={23} height={23} borderRadius={7} /></View>;
  return <View accessibilityLabel="正在加载作品互动和作者信息" accessibilityState={{ busy: true }}>
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {["like", "comment", "bookmark"].map(action)}<View style={{ flex: 1 }} />{["open", "share", "detail"].map(action)}
    </View>
    <View style={{ height: 44, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Skeleton animated={animated} width={32} height={32} borderRadius={16} />
        <View style={{ flex: 1, gap: 6 }}><Skeleton animated={animated} width="55%" height={12} borderRadius={6} /><Skeleton animated={animated} width="85%" height={10} borderRadius={5} /></View>
      </View>
      <Skeleton animated={animated} width={64} height={32} borderRadius={t.radius.pill} />
    </View>
  </View>;
}

function ExperienceSkeleton() {
  const { colors: t } = useTheme();
  return <View accessibilityLabel="正在加载应用体验区域" accessibilityState={{ busy: true }} style={{ width: "100%", gap: 16 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Skeleton width={32} height={32} borderRadius={10} /><Skeleton width="50%" height={14} borderRadius={7} /></View>
    <Skeleton width="100%" height={180} borderRadius={t.radius.lg} />
    <Skeleton width="75%" height={12} borderRadius={6} /><Skeleton width="100%" height={44} borderRadius={t.radius.md} />
  </View>;
}

function ExperiencePlaceholder({ item, onResume }: { item: MarketApplication; onResume?: () => void }) {
  const { colors: t } = useTheme();
  return <View style={{ flex: 1, backgroundColor: t.canvas, padding: 28, alignItems: "center", justifyContent: "center", gap: 18 }}>
    <ApplicationIcon application={item} size={64} />
    <Text style={{ color: t.ink1, fontSize: 22, fontWeight: "700", textAlign: "center" }}>{item.title || item.manifest.appName}</Text>
    <Text style={{ color: t.ink3, lineHeight: 23, textAlign: "center" }}>{item.summary || item.manifest.description}</Text>
    {onResume ? <Pressy accessibilityRole="button" onPress={onResume} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 24, backgroundColor: t.accent, borderRadius: t.radius.pill }}><Text style={{ color: t.onAccent, fontWeight: "700" }}>继续体验</Text></Pressy> : null}
  </View>;
}
