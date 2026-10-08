import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PagerView, { type PagerViewOnPageScrollEvent, type PagerViewOnPageSelectedEvent, type PageScrollStateChangedNativeEvent } from "react-native-pager-view";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useEvent, useSharedValue } from "react-native-reanimated";
import { Ambient, Pressy, RoundButton } from "../../../../packages/ui/chrome";
import { useTheme } from "../../../../packages/ui/theme";
import { ApplicationFeedScreen } from "./ApplicationFeedScreen";
import { CommonApplicationsScreen } from "./CommonApplicationsScreen";
import { CompactTabs } from "./CompactTabs";
import { UserAvatar } from "./UserAvatar";
import { useAccount } from "./account";
import { useProfileDrawer } from "./ProfileDrawer";
import { useVisitedPager } from "./useVisitedPager";
import { beginRouteTransition, endRouteTransition } from "./interactionWork";
import NativePluginHost from "../NativePluginHost";

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);
const options = [{ id: "discovery", label: "发现作品" }, { id: "common", label: "常用" }] as const;
const TRANSITION = "application-home-pages";
type Tab = typeof options[number]["id"];
type Props = Omit<Parameters<typeof ApplicationFeedScreen>[0], "active" | "stageGesture"> & { onOpen: (id: string) => Promise<boolean> };

export function ApplicationHomeScreen(props: Props) {
  const { colors, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAccount();
  const { applicationActive, gesture: drawerGesture } = useProfileDrawer();
  const [tab, setTab] = useState<Tab>("discovery");
  const pager = useRef<PagerView>(null);
  const position = useSharedValue(0);
  const { visited, visit, reveal } = useVisitedPager();
  const stageGesture = useMemo(() => Gesture.Native().shouldActivateOnStart(true), []);
  const pagerGesture = useMemo(() => Gesture.Native().requireExternalGestureToFail(stageGesture, drawerGesture), [stageGesture, drawerGesture]);
  useFocusEffect(useCallback(() => {
    applicationActive.value = true;
    return () => { applicationActive.value = false; };
  }, [applicationActive]));
  useFocusEffect(useCallback(() => {
    void NativePluginHost.call("shell", "systemBars", JSON.stringify({ statusBar: colors.canvas, window: colors.canvas, light: mode === "light" })).catch(() => {});
  }, [colors.canvas, mode]));
  useEffect(() => () => endRouteTransition(TRANSITION), []);
  const select = useCallback((value: Tab) => {
    Keyboard.dismiss();
    visit(value === "common" ? 1 : 0);
    pager.current?.setPage(value === "common" ? 1 : 0);
  }, [visit]);
  const selected = useCallback((index: number) => {
    Keyboard.dismiss();
    setTab(index === 1 ? "common" : "discovery");
  }, []);
  const scrolling = useCallback((state: string) => {
    if (state === "idle") endRouteTransition(TRANSITION);
    else beginRouteTransition(TRANSITION);
  }, []);
  const onPageScroll = useEvent<PagerViewOnPageScrollEvent>(event => {
    "worklet";
    reveal(event.position, event.offset);
    position.value = event.position + event.offset;
  }, ["onPageScroll"]);
  const onPageSelected = useEvent<PagerViewOnPageSelectedEvent>(event => {
    "worklet";
    runOnJS(selected)(event.position);
  }, ["onPageSelected"]);
  const onPageScrollStateChanged = useEvent<PageScrollStateChangedNativeEvent>(event => {
    "worklet";
    runOnJS(scrolling)(event.pageScrollState);
  }, ["onPageScrollStateChanged"]);

  return <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top }}>
    <Ambient />
    <View style={{ height: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Pressy accessibilityRole="button" accessibilityLabel="打开我的侧边抽屉" onPress={props.onProfile} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><UserAvatar uri={user?.avatarUrl} size={30} /></Pressy>
      <View style={{ flex: 1, alignItems: "center" }}><View style={{ width: "100%", maxWidth: 240 }}><CompactTabs value={tab} options={options} onChange={select} position={position} /></View></View>
      <RoundButton icon="search" label="搜索作品" onPress={props.onSearch} />
    </View>
    <GestureDetector gesture={pagerGesture}>
      <AnimatedPagerView ref={pager} style={{ flex: 1 }} initialPage={0} offscreenPageLimit={1} overScrollMode="never" onPageScroll={onPageScroll} onPageSelected={onPageSelected} onPageScrollStateChanged={onPageScrollStateChanged}>
        <View key="discovery" collapsable={false} style={{ flex: 1 }}><ApplicationFeedScreen {...props} active={tab === "discovery"} stageGesture={stageGesture} /></View>
        <View key="common" collapsable={false} style={{ flex: 1 }}>{visited.has(1) ? <CommonApplicationsScreen active={tab === "common"} onOpen={props.onOpen} /> : null}</View>
      </AnimatedPagerView>
    </GestureDetector>
  </View>;
}
