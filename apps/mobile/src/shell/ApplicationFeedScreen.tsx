import { Activity, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, BackHandler, Keyboard, View, type LayoutChangeEvent } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { cancelAnimation, Easing, ReduceMotion, runOnJS, runOnUI, scrollTo, useAnimatedReaction, useAnimatedRef, useSharedValue, withTiming } from "react-native-reanimated";
import { Ambient, Pressy, RoundButton } from "../../../../packages/ui/chrome";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { ThemeContext, useTheme } from "../../../../packages/ui/theme";
import { Skeleton } from "../../../../packages/ui/feedback/Skeleton";
import { afterInteractions, beginRouteTransition, endRouteTransition } from "./interactionWork";
import NativePluginHost from "../NativePluginHost";
import { ApplicationIcon } from "./ApplicationIcon";
import { UserAvatar } from "./UserAvatar";
import { HostText as Text } from "./feed/HostText";
import { useAccount } from "./account";
import { useProfileDrawer } from "./ProfileDrawer";
import { bindApplicationExperienceBack, bindNextApplication } from "./applicationExperienceNavigation";
import { EXPERIENCE_AHEAD, EXPERIENCE_CACHE_SIZE, experienceId, useApplicationExperienceQueue } from "./useApplicationExperienceQueue";
import { ApplicationInteractions } from "./ApplicationInteractions";
import type { UserPost } from "./feed/userPosts";
import { ApplicationCommentsSheet } from "./ApplicationCommentsSheet";
import { AnimatedFlashList, type FlashListRef } from "./AnimatedFlashList";
import { fetchMarketPage, type MarketApplication, type MarketPage } from "./market";

type Props = {
  renderApplication: (id: string, onBack: () => void) => ReactNode;
  onProfile: () => void;
  onSearch: () => void;
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
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { user } = useAccount();
  const identity = user?.id ?? "guest";
  const { applicationActive, progress } = useProfileDrawer();
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
  useFocusEffect(useCallback(() => {
    applicationActive.value = true;
    void NativePluginHost.call("shell", "systemBars", JSON.stringify({ statusBar: t.canvas, window: t.canvas, light: theme.mode === "light" })).catch(() => {});
    return () => { applicationActive.value = false; };
  }, [applicationActive, t.canvas, theme.mode]));

  const setPause = useCallback((value: boolean) => { pausedRef.current = value; setPaused(value); }, []);
  const pauseExperience = useCallback(() => setPause(true), [setPause]);
  const resumeExperience = useCallback(() => setPause(false), [setPause]);
  useEffect(() => {
    if (!switching) return;
    beginRouteTransition(SWITCH_INTERACTION);
    return () => endRouteTransition(SWITCH_INTERACTION);
  }, [switching]);
  useFocusEffect(useCallback(() => {
    const leave = () => {
      if (!item || pausedRef.current) return false;
      Keyboard.dismiss();
      setPause(true);
      return true;
    };
    const unbind = bindApplicationExperienceBack(leave);
    const back = BackHandler.addEventListener("hardwareBackPress", leave);
    return () => { unbind(); back.remove(); };
  }, [item?.manifest.appId, setPause]));

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
    drag.value = withTiming(-direction * height, timing, done => {
      if (done) runOnJS(commit)(direction);
      else { moving.value = false; runOnJS(setSwitching)(false); }
    });
  }, [next, previous, height, commit, drag, moving, startSwitch]);
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
  useFocusEffect(useCallback(() => bindNextApplication(advance), [advance]));
  const layout = (event: LayoutChangeEvent) => { setHeight(Math.max(1, event.nativeEvent.layout.height)); setWidth(Math.max(1, event.nativeEvent.layout.width)); };

  return <ThemeContext.Provider value={theme}>
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: insets.top }}>
      <Ambient />
      <View style={{ height: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressy accessibilityRole="button" accessibilityLabel="打开我的侧边抽屉" onPress={props.onProfile} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}><UserAvatar uri={user?.avatarUrl} size={30} /></Pressy>
        <Text accessibilityRole="header" style={{ color: t.ink1, fontSize: 17, fontWeight: "700" }}>发现作品</Text>
        <RoundButton icon="search" label="搜索作品" onPress={props.onSearch} />
      </View>
      <View style={{ flex: 1, marginHorizontal: 4, borderRadius: t.radius.xxl, overflow: "hidden", backgroundColor: appTheme.colors.canvas }} onLayout={layout}>
        {item && height > 1 && width > 1 ? <ExperienceQueue key={`${identity}:${revision}`} items={items} index={index} active={active} foreground={foreground && !drawerOpen} switching={switching} paused={paused} width={width} height={height} drag={drag} render={props.renderApplication} onPause={pauseExperience} onResume={resumeExperience} onDetail={props.onDetail} /> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 16 }}>
            {!page.loaded && !error ? <ExperienceSkeleton /> : <><Text style={{ color: appTheme.colors.ink1, fontSize: 17, fontWeight: "700" }}>{error ? "作品暂时未能加载" : "还没有公开作品"}</Text><Text style={{ color: appTheme.colors.ink3, textAlign: "center", lineHeight: 21 }}>{error || "先去创作一个，让大家刷到你的想法。"}</Text><Pressy accessibilityRole="button" onPress={() => void load()} style={{ padding: 14 }}><Text style={{ color: appTheme.colors.accentText }}>重新加载</Text></Pressy></>}
          </View>}
        <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ position: "absolute", inset: 0, zIndex: 3, borderWidth: 1, borderColor: t.lineStrong, borderRadius: t.radius.xxl }} />
      </View>
      <GestureDetector gesture={swipe}>
        <View collapsable={false} accessibilityLabel="底部互动区，上下滑动切换作品，也可点击底部下一个箭头" style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 4 }}>
          {!item && (page.owner !== identity || (!page.loaded && !error)) ? <DiscoveryFooterSkeleton animated={active} /> : null}
          {item ? <ApplicationInteractions key={`${identity}:${item.manifest.appId}`} item={item} active={active && !switching} onComment={setCommentPost} onShare={() => props.onShare(item)} onDetail={() => props.onDetail(item)} /> : null}
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
  width: number; height: number; drag: ReturnType<typeof useSharedValue<number>>;
  render: Props["renderApplication"]; onPause: () => void; onResume: () => void; onDetail: Props["onDetail"];
};
function ExperienceQueue(props: QueueProps) {
  const { entries, preparations, retry } = useApplicationExperienceQueue(props.items, props.index, props.active && !props.switching);
  const current = props.items[props.index];
  const positions = useMemo(() => new Map(props.items.map((item, index) => [experienceId(item), index])), [props.items]);
  // Keep the retained app instances in feed order, with stable app/version identity.
  const pages = useMemo(() => [...entries].sort((a, b) => (positions.get(experienceId(a)) ?? 0) - (positions.get(experienceId(b)) ?? 0)), [entries, positions]);
  const pageIndex = pages.findIndex(item => experienceId(item) === experienceId(current));
  const list = useAnimatedRef<FlashListRef<MarketApplication>>();
  const ready = useSharedValue(false);
  const { height, drag } = props;
  const baseOffset = useSharedValue(0);
  const syncPosition = useCallback(() => {
    runOnUI((offset: number) => {
      // Rebase the completed gesture and the list origin atomically. Reading
      // the old drag with the new page index briefly targets the following page.
      cancelAnimation(drag);
      drag.value = 0;
      baseOffset.value = offset;
    })(Math.max(0, pageIndex * height));
  }, [pageIndex, height, props.index, drag, baseOffset]);
  useLayoutEffect(syncPosition, [syncPosition]);
  useAnimatedReaction(() => ready.value ? Math.max(0, baseOffset.value - drag.value) : -1, offset => {
    if (offset >= 0) scrollTo(list, 0, offset, false);
  }, [list, baseOffset, drag]);
  return <AnimatedFlashList ref={list} data={pages} keyExtractor={experienceId} getItemType={experienceId}
    initialScrollIndex={Math.max(0, pageIndex)} scrollEnabled={false} showsVerticalScrollIndicator={false}
    bounces={false} overScrollMode="never" maintainVisibleContentPosition={{ disabled: true }}
    // Draw nearby pages only. Unique types retain visited app state in the pool;
    // deleting an identity from the seven-page data window evicts its cell.
    drawDistance={height} maxItemsInRecyclePool={EXPERIENCE_CACHE_SIZE}
    onLoad={() => { syncPosition(); ready.value = true; }}
    renderItem={({ item, target }) => {
      if (target === "Measurement") return <View style={{ height, width: props.width }} />;
      const offset = (positions.get(experienceId(item)) ?? -2) - props.index;
      const selected = experienceId(item) === experienceId(current);
      const nearby = Math.abs(offset) <= 1;
      return <CachedExperience item={item} selected={selected}
        ready={preparations.get(experienceId(item))?.ready ?? false} error={preparations.get(experienceId(item))?.error ?? ""} onRetry={retry}
        interactive={selected && props.active && !props.switching}
        accessible={selected && props.active}
        visible={props.active && !props.paused && nearby}
        paused={selected && props.paused} foreground={props.foreground}
        width={props.width} height={height} render={props.render}
        onPause={props.onPause} onResume={props.onResume} onDetail={props.onDetail} />;
    }} />;
}
type CachedExperienceProps = Omit<QueueProps, "items" | "index" | "active" | "switching" | "drag"> & {
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
    <SafeAreaProvider style={{ flex: 1 }} initialMetrics={metrics}>
      <InlineExperience ready={ready} error={error} selected={selected} foreground={props.foreground} visible={props.visible} render={props.render} appId={item.manifest.appId} onRetry={retry} onPause={pause} onDetail={detail} />
      {props.paused ? <View style={{ position: "absolute", inset: 0 }}><ExperiencePlaceholder item={item} onResume={props.onResume} /></View> : null}
    </SafeAreaProvider>
  </View>;
});

const InlineExperience = memo(function InlineExperience({ appId, ready, error, selected, foreground, visible, render, onRetry, onPause, onDetail }: { appId: string; ready: boolean; error: string; selected: boolean; foreground: boolean; visible: boolean; render: Props["renderApplication"]; onRetry: () => void; onPause: () => void; onDetail: () => void }) {
  const { colors: t } = useTheme();
  const showing = foreground && visible;
  const [retainedVisible, setRetainedVisible] = useState(false);
  useEffect(() => {
    if (!ready) return;
    // Prepare the adjacent native pages while idle, rather than restoring them
    // when the finger starts moving. Only three nearby pages run effects.
    return afterInteractions(() => setRetainedVisible(showing));
  }, [ready, showing]);
  const content = useMemo(() => render(appId, onPause), [render, appId, onPause]);
  if (ready) return <Activity mode={foreground && ((showing && selected) || retainedVisible) ? "visible" : "hidden"}><View style={{ flex: 1 }}>{content}</View></Activity>;
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
      {["like", "comment", "bookmark"].map(action)}<View style={{ flex: 1 }} />{["share", "detail"].map(action)}
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
