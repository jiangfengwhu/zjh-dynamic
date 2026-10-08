import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, BackHandler, Keyboard, View, type LayoutChangeEvent } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { cancelAnimation, Easing, ReduceMotion, runOnJS, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Pressy, RoundButton } from "../../../../packages/ui/chrome";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { ThemeContext, getTheme, useTheme } from "../../../../packages/ui/theme";
import { Skeleton } from "../../../../packages/ui/feedback/Skeleton";
import { loadPublicApplicationExperience } from "../runtime/applications";
import NativePluginHost from "../NativePluginHost";
import { ApplicationIcon } from "./ApplicationIcon";
import { UserAvatar } from "./UserAvatar";
import { HostText as Text } from "./feed/HostText";
import { useAccount } from "./account";
import { useProfileDrawer } from "./ProfileDrawer";
import { bindApplicationExperienceBack } from "./applicationExperienceNavigation";
import { fetchMarketPage, type MarketApplication, type MarketPage } from "./market";

type Props = {
  renderApplication: (id: string, onBack: () => void) => ReactNode;
  onProfile: () => void;
  onSearch: () => void;
  onDetail: (item: MarketApplication) => void;
  onOpen: (id: string) => void;
  onShare: (item: MarketApplication) => void;
  onRemix: (item: MarketApplication) => void;
  onAuthor: (author: { id: string; name: string; avatarUrl: string | null; official?: boolean }) => void;
};
const timing = { duration: 200, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };
const unique = (items: MarketApplication[]) => [...new Map(items.map(item => [item.manifest.appId, item])).values()];

/** Only the lower switching surface owns paging; the native app stage owns its touches. */
export function ApplicationFeedScreen(props: Props) {
  const appTheme = useTheme();
  const theme = useMemo(() => ({ ...appTheme, mode: "dark" as const, colors: getTheme("dark") }), [appTheme]);
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

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => setForeground(state === "active"));
    return () => subscription.remove();
  }, []);
  useAnimatedReaction(() => progress.value > 0.001, (open, prior) => {
    if (open !== prior) runOnJS(setDrawerOpen)(open);
  }, [progress]);
  useFocusEffect(useCallback(() => {
    applicationActive.value = true;
    void NativePluginHost.call("shell", "systemBars", JSON.stringify({ statusBar: t.canvas, window: t.canvas, light: false })).catch(() => {});
    return () => { applicationActive.value = false; };
  }, [applicationActive, t.canvas]));

  const setPause = useCallback((value: boolean) => { pausedRef.current = value; setPaused(value); }, []);
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
    if (active && page.loaded && page.nextCursor && items.length - index <= 3 && !busy && !error) void load(true);
  }, [active, page.loaded, page.nextCursor, items.length, index, busy, error, load]);

  const commit = useCallback((direction: number) => {
    Keyboard.dismiss();
    setIndex(value => Math.max(0, Math.min(items.length - 1, value + direction)));
    setPause(false);
  }, [items.length, setPause]);
  useLayoutEffect(() => {
    cancelAnimation(drag);
    drag.value = 0;
    moving.value = false;
  }, [index, identity, revision, active, drag, moving]);
  const finish = useCallback((direction: number) => {
    "worklet";
    if (moving.value) return;
    if (direction > 0 ? !next : !previous) { drag.value = withTiming(0, timing); return; }
    moving.value = true;
    drag.value = withTiming(-direction * height, timing, done => {
      if (done) runOnJS(commit)(direction);
      else moving.value = false;
    });
  }, [next, previous, height, commit, drag, moving]);
  const swipe = useMemo(() => Gesture.Pan()
    .enabled(active && Boolean(item))
    .maxPointers(1)
    .activeOffsetY([-8, 8])
    .failOffsetX([-25, 25])
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
      else drag.value = withTiming(0, timing);
    })
    .onFinalize(() => { if (!moving.value) drag.value = withTiming(0, timing); }),
    [active, item, next, previous, height, finish, moving, drag]);
  const stageMotion = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  const nextMotion = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value + height }] }));
  const previousMotion = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value - height }] }));
  const layout = (event: LayoutChangeEvent) => { setHeight(Math.max(1, event.nativeEvent.layout.height)); setWidth(Math.max(1, event.nativeEvent.layout.width)); };

  return <ThemeContext.Provider value={theme}>
    <View style={{ flex: 1, backgroundColor: t.canvas, paddingTop: insets.top }}>
      <View style={{ height: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressy accessibilityRole="button" accessibilityLabel="打开我的侧边抽屉" onPress={props.onProfile} style={{ width: 44, height: 44, justifyContent: "center", alignItems: "center" }}><UserAvatar uri={user?.avatarUrl} size={30} /></Pressy>
        <Text accessibilityRole="header" style={{ color: t.ink1, fontSize: 17, fontWeight: "700" }}>发现作品</Text>
        <RoundButton icon="search" label="搜索作品" onPress={props.onSearch} />
      </View>
      <View style={{ flex: 1, marginHorizontal: 4, borderRadius: t.radius.xl, overflow: "hidden", backgroundColor: appTheme.colors.canvas }} onLayout={layout}>
        {previous ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ position: "absolute", inset: 0 }, previousMotion]}><ExperiencePlaceholder item={previous} /></Animated.View> : null}
        {next ? <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ position: "absolute", inset: 0 }, nextMotion]}><ExperiencePlaceholder item={next} /></Animated.View> : null}
        <Animated.View style={[{ flex: 1, overflow: "hidden", backgroundColor: appTheme.colors.canvas }, stageMotion]}>
          {item ? <ThemeContext.Provider value={appTheme}>
            <SafeAreaProvider key={`${identity}:${item.manifest.appId}`} style={{ flex: 1 }} initialMetrics={{ frame: { x: 0, y: 0, width, height }, insets: { top: 0, bottom: 0, left: 0, right: 0 } }}>
              {active && !paused ? <InlineExperience key={`${identity}:${item.manifest.appId}:${item.manifest.releaseId}:${revision}`} item={item} render={props.renderApplication} onPause={() => setPause(true)} onDetail={() => props.onDetail(item)} /> : <ExperiencePlaceholder item={item} onResume={active ? () => setPause(false) : undefined} />}
            </SafeAreaProvider>
          </ThemeContext.Provider> : <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 16 }}>
            {!page.loaded && !error ? <ExperienceSkeleton /> : <><Text style={{ color: appTheme.colors.ink1, fontSize: 17, fontWeight: "700" }}>{error ? "作品暂时未能加载" : "还没有公开作品"}</Text><Text style={{ color: appTheme.colors.ink3, textAlign: "center", lineHeight: 21 }}>{error || "先去创作一个，让大家刷到你的想法。"}</Text><Pressy accessibilityRole="button" onPress={() => void load()} style={{ padding: 14 }}><Text style={{ color: appTheme.colors.accentText }}>重新加载</Text></Pressy></>}
          </View>}
        </Animated.View>
      </View>
      <GestureDetector gesture={swipe}>
        <View collapsable={false} accessibilityLabel="底部互动区，上下滑动切换作品，也可点击上一条和下一条" style={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            {item ? <>
              <ExperienceAction icon="info" label="详情" onPress={() => props.onDetail(item)} />
              <ExperienceAction icon="share" label="分享" onPress={() => props.onShare(item)} />
              <ExperienceAction icon="send" label="完整打开" onPress={() => props.onOpen(item.manifest.appId)} />
            </> : <Text style={{ color: t.ink2, fontSize: 13 }}>每次上滑，遇见一个新作品</Text>}
            <View style={{ flex: 1 }} />
          <Pressy accessibilityRole="button" accessibilityLabel="上一个作品" disabled={!previous} onPress={() => finish(-1)} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", opacity: previous ? 1 : 0.3 }}><View style={{ transform: [{ rotate: "180deg" }] }}><SymbolIcon name="down" color={t.ink1} /></View></Pressy>
          <Pressy accessibilityRole="button" accessibilityLabel={next ? "下一个作品" : error && page.nextCursor ? "重试加载更多作品" : "刷新作品"} disabled={busy && !next} onPress={() => next ? finish(1) : void load(Boolean(page.nextCursor))} style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center" }}><SymbolIcon name={next ? "down" : "refresh"} color={t.ink1} /></Pressy>
          </View>
          {item ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressy accessibilityRole="button" accessibilityLabel={`查看作者${item.authorName}`} disabled={!item.authorId} onPress={() => item.authorId && props.onAuthor({ id: item.authorId, name: item.authorName, avatarUrl: item.authorAvatarUrl ?? null, official: item.authorOfficial })} style={{ flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <UserAvatar uri={item.authorAvatarUrl} size={32} />
              <Text numberOfLines={1} style={{ flex: 1, color: t.ink1, fontSize: 13 }}><Text style={{ fontWeight: "700" }}>{item.authorName || "创作者"}</Text> · {item.title || item.manifest.appName}</Text>
            </Pressy>
            <Pressy accessibilityRole="button" accessibilityLabel="改编这个作品" onPress={() => props.onRemix(item)} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: t.radius.pill, backgroundColor: t.surfaceRaised, flexDirection: "row", alignItems: "center", gap: 6 }}><SymbolIcon name="layers" size={17} color={t.ink1} /><Text style={{ color: t.ink1, fontSize: 13, fontWeight: "700" }}>改编</Text></Pressy>
          </View> : null}
          <Text numberOfLines={1} style={{ color: t.ink3, fontSize: 11, lineHeight: 18, textAlign: "center" }}>{error && items.length ? "加载更多失败，点击右侧重试" : next ? "在底部区域上下滑动切换作品" : busy ? "正在寻找更多作品…" : item ? "已经到底，可以回看或刷新" : "中间玩应用，下方切作品"}</Text>
        </View>
      </GestureDetector>
    </View>
  </ThemeContext.Provider>;
}

function ExperienceAction({ icon, label, onPress }: { icon: "info" | "share" | "send"; label: string; onPress: () => void }) {
  const { colors: t } = useTheme();
  return <Pressy accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ minWidth: label === "完整打开" ? 64 : 48, minHeight: 48, paddingHorizontal: 3, alignItems: "center", justifyContent: "center", gap: 3 }}><SymbolIcon name={icon} size={21} color={t.ink1} /><Text style={{ color: t.ink2, fontSize: 10 }}>{label}</Text></Pressy>;
}

function InlineExperience({ item, render, onPause, onDetail }: { item: MarketApplication; render: Props["renderApplication"]; onPause: () => void; onDetail: () => void }) {
  const { colors: t } = useTheme();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setReady(false);
    void loadPublicApplicationExperience(item.manifest, controller.signal).then(() => {
      if (!controller.signal.aborted) setReady(true);
    }, cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "暂时无法体验这个作品");
    });
    return () => controller.abort();
  }, [item.manifest.appId, item.manifest.releaseId, attempt]);
  if (ready) return <View style={{ flex: 1 }}>{render(item.manifest.appId, onPause)}</View>;
  return <View style={{ flex: 1, padding: 24, alignItems: "center", justifyContent: "center", gap: 16 }}>
    {error ? <><SymbolIcon name="alert" size={28} color={t.orange} /><Text style={{ color: t.ink1, fontSize: 17, fontWeight: "700" }}>暂时无法体验</Text><Text style={{ color: t.ink3, lineHeight: 21, textAlign: "center" }}>{error}</Text><View style={{ flexDirection: "row", gap: 20 }}><Pressy accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={{ padding: 14 }}><Text style={{ color: t.accentText }}>重试</Text></Pressy><Pressy accessibilityRole="button" onPress={onDetail} style={{ padding: 14 }}><Text style={{ color: t.accentText }}>查看详情</Text></Pressy></View></> : <><ExperienceSkeleton /><Text accessibilityLiveRegion="polite" style={{ color: t.ink3, fontSize: 13 }}>正在准备真实应用…</Text></>}
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
