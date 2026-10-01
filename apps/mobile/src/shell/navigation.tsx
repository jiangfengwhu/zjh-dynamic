const bootstrap = require("../../../../tools/applications/bootstrap.json");
import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen, ScreenEdge, useKeyboardOpen } from "../../../../packages/ui/edge";
import {
  NavigationContainer,
  DefaultTheme,
  createNavigationContainerRef,
  useIsFocused,
  type NavigationState,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import type { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";
import { TabBar, type ShellTabId } from "./TabBar";
import { FeedScreen } from "./feed/FeedScreen";
import { type AppEntry } from "./catalog";
import { MyApplicationsScreen } from "./MyApplicationsScreen";
import { MarketScreen } from "./MarketScreen";
import { MarketDetailScreen } from "./MarketDetailScreen";
import type { MarketApplication } from "./market";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { MineScreen } from "./MineScreen";
import { requireAccount } from "./account";
import { AccountScreen } from "./AccountScreen";
import { ProvidersScreen } from "./ProvidersScreen";
import { AppInfoScreen } from "./AppInfoScreen";
import { AppearanceScreen } from "./AppearanceScreen";
import { SummaryScreen } from "./SummaryScreen";
import { palettes, useTheme, type ThemeMode } from "../../../../packages/ui/theme";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";

export type TabParamList = {
  feed: undefined;
  market: undefined;
  mine: undefined;
};

export type RootParamList = {
  tabs: NavigatorScreenParams<TabParamList> | undefined;
  providers: undefined;
  info: undefined;
  summary: undefined;
  appearance: undefined;
  bundle: { id: string };
  marketDetail: { item: MarketApplication };
  myApps: undefined;
  account: undefined;
};

export const shellNavigationRef = createNavigationContainerRef<RootParamList>();

const Stack = createNativeStackNavigator<RootParamList>();
const Tabs = createMaterialTopTabNavigator<TabParamList>();

export function openShellTab(id: ShellTabId) {
  if (!shellNavigationRef.isReady()) return;
  shellNavigationRef.navigate("tabs", { screen: id });
}

export function openShellBundle(id: string) {
  if (!shellNavigationRef.isReady()) return;
  console.log("route push", "bundle", id);
  shellNavigationRef.navigate("bundle", { id });
}

function goBack() {
  if (shellNavigationRef.isReady() && shellNavigationRef.canGoBack()) {
    shellNavigationRef.goBack();
  } else { openShellTab("feed"); }
}

/**
 * 朋友们自己的页面在功能包里，够不着壳的导航，于是通过这个键来请求：
 * 写入 `{"action":"tab","tab":"agent"}`、`{"action":"open","id":"jolly"}` 或 `{"action":"back"}`，
 * 再带一个 `at` 时间戳让每次写入都不相同。壳收到后替它们跳转。
 */
export const SHELL_NAV_REQUEST = "shell.nav.request";

const SHELL_TAB_IDS: readonly string[] = ["feed", "market", "mine"];

function handleShellRequest(raw: string | undefined) {
  if (!raw) return;
  try {
    const request = JSON.parse(raw) as { action?: string; tab?: string; id?: string };
    console.log("shell request", request.action, request.tab ?? request.id ?? "");
    if (request.action === "account") shellNavigationRef.navigate("account");
    else if (request.action === "back") goBack();
    else if (request.action === "tab" && request.tab === "agent") applicationContext(bootstrap.defaultApplication).navigation.create();
    else if (request.action === "tab" && request.tab && SHELL_TAB_IDS.includes(request.tab)) openShellTab(request.tab as ShellTabId);
    else if (request.action === "open" && request.id) openShellBundle(request.id);
  } catch (error) {
    console.log("shell request unreadable", error instanceof Error ? error.message : error);
  }
}

/** 已经在后台挂好的页面直接显示。还没挂好时，等转场结束再挂，避免动画中途白屏或卡顿。 */
function BundlePage({
  id,
  navigation,
  render,
}: {
  id: string;
  navigation: NativeStackNavigationProp<RootParamList, "bundle">;
  render: (id: string, onBack: () => void) => ReactNode;
}) {
  const colors = palettes[useTheme().mode];
  const focused = useIsFocused();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (shown) return;
    if (!focused) {
      console.log("bundle shown", id, "cache");
      setShown(true);
      return;
    }
    let settled = false;
    const reveal = (reason: string) => {
      if (settled) return;
      settled = true;
      console.log("bundle shown", id, reason);
      setShown(true);
    };
    const unsubscribe = navigation.addListener("transitionEnd", (event) => {
      if (event.data.closing) return;
      reveal("transition");
    });
    const timer = setTimeout(() => reveal("animation"), 200);
    return () => {
      settled = true;
      unsubscribe();
      clearTimeout(timer);
    };
  }, [focused, id, navigation, shown]);
  const Page = id === bootstrap.defaultApplication ? View : Screen;
  return (
    <Page style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={styles.feature}>
        {shown ? render(id, goBack) : null}
      </View>
    </Page>
  );
}

function ShellTabBar({ state, jumpTo }: MaterialTopTabBarProps) {
  const active = state.routes[state.index]?.name ?? "feed";
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const keyboard = useKeyboardOpen();
  return (
    <View style={{ backgroundColor: colors.canvas, paddingBottom: keyboard ? 0 : insets.bottom }}>
      <TabBar
        activeId={active}
        onChange={(id) => {
          const route = state.routes.find((item) => item.name === id);
          if (route) jumpTo(route.key);
        }}
      />
    </View>
  );
}

export type ShellNavigatorProps = {
  mode: ThemeMode;
  listed: AppEntry[];
  onOpenBundle: (id: string) => void;
  /** 在动态里对某位朋友说一句：去工坊，带着 TA 的名字起个头。 */
  onReplyToFriend: (id: string) => void;
  onCheckUpdates: () => Promise<boolean>;
  onMode: (mode: ThemeMode) => void;
  renderBundle: (id: string, onBack: () => void) => ReactNode;
};

export function ShellNavigator(props: ShellNavigatorProps) {
  const previous = useRef({ label: "", depth: 1 });
  const colors = palettes[props.mode];
  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.canvas,
      card: colors.canvas,
      text: colors.ink1,
      border: colors.line,
      primary: colors.accent,
    },
  };

  useEffect(() => subscribePackageValue(SHELL_NAV_REQUEST, handleShellRequest), []);

  function onStateChange(state: NavigationState | undefined) {
    if (!state) return;
    const top = state.routes[state.index];
    let label = top?.name ?? "";
    let detail = "";
    if (top?.name === "tabs" && top.state) {
      const tabState = top.state as NavigationState;
      const tab = tabState.routes[tabState.index ?? 0];
      label = "tab";
      detail = tab?.name ?? "";
    } else if (top?.name === "bundle") {
      detail = (top.params as { id?: string } | undefined)?.id ?? "";
    }
    const depth = state.routes.length;
    const key = `${label}:${detail}:${depth}`;
    if (key === previous.current.label) return;
    if (label === "tab") {
      console.log("route tab", detail);
    } else if (depth < previous.current.depth) console.log("route pop", label, detail);
    else console.log("route push", label, detail, "depth", depth);
    previous.current = { label: key, depth };
  }

  return (
    <NavigationContainer ref={shellNavigationRef} theme={theme} onStateChange={onStateChange}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          animationDuration: 180,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="tabs">
          {() => (
            <ScreenEdge bottom={false}>
            <Tabs.Navigator
              backBehavior="none"
              tabBarPosition="bottom"
              tabBar={(tabProps) => <ShellTabBar {...tabProps} />}
              screenOptions={{
                swipeEnabled: true,
                lazy: true,
                sceneStyle: { backgroundColor: colors.canvas },
              }}
            >
              <Tabs.Screen name="feed">
                {() => (
                  <FeedScreen
                    onOpen={props.onOpenBundle}
                    onReply={props.onReplyToFriend}
                    installedIds={props.listed.map(item => item.id)}
                    onNew={() => openShellTab("market")}
                  />
                )}
              </Tabs.Screen>
              <Tabs.Screen name="market">
                {() => <MarketScreen onDetail={item => shellNavigationRef.navigate("marketDetail", { item })} onCreate={() => { void requireAccount().then(allowed => { if (allowed) applicationContext(bootstrap.defaultApplication).navigation.create(); }); }} />}
              </Tabs.Screen>
              <Tabs.Screen name="mine">
                {() => (
                  <MineScreen
                    onAccount={() => shellNavigationRef.navigate("account")}
                    mode={props.mode}
                    onApplications={() => shellNavigationRef.navigate("myApps")}
                    onCompanion={() => props.onOpenBundle(bootstrap.defaultApplication)}
                    onProviders={() => shellNavigationRef.navigate("providers")}
                    onInfo={() => shellNavigationRef.navigate("info")}
                    onCheckUpdates={props.onCheckUpdates}
                    onSummary={() => shellNavigationRef.navigate("summary")}
                    onAppearance={() => shellNavigationRef.navigate("appearance")}
                  />
                )}
              </Tabs.Screen>
            </Tabs.Navigator>
            </ScreenEdge>
          )}
        </Stack.Screen>
        <Stack.Screen name="marketDetail">
          {({ route }) => <MarketDetailScreen item={route.params.item} onBack={goBack} onOpen={props.onOpenBundle} />}
        </Stack.Screen>
        <Stack.Screen name="myApps">
          {() => <MyApplicationsScreen onOpen={props.onOpenBundle} onBack={goBack} onDetail={item => shellNavigationRef.navigate("marketDetail", { item })} onCreate={() => { void requireAccount().then(allowed => { if (allowed) applicationContext(bootstrap.defaultApplication).navigation.create(); }); }} />}
        </Stack.Screen>
        <Stack.Screen name="account">
          {() => <AccountScreen onBack={goBack} />}
        </Stack.Screen>
        <Stack.Screen name="providers">
          {() => <ProvidersScreen onBack={goBack} />}
        </Stack.Screen>
        <Stack.Screen name="summary">
          {() => <SummaryScreen onBack={goBack} />}
        </Stack.Screen>
        <Stack.Screen name="appearance">
          {() => <AppearanceScreen mode={props.mode} onMode={props.onMode} onBack={goBack} />}
        </Stack.Screen>
        <Stack.Screen name="info">
          {() => (
            <AppInfoScreen onBack={goBack} />
          )}
        </Stack.Screen>
        <Stack.Screen name="bundle" getId={({ params }) => params.id}>
          {({ route, navigation }) => (
            <BundlePage id={route.params.id} navigation={navigation} render={props.renderBundle} />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  feature: {
    flex: 1,
  },
});
