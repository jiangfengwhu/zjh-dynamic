import { beginRouteTransition, endRouteTransition } from "./interactionWork";
import { isApplicationInstalledSync } from "./market";
import { markStartup } from "../runtime/startupTiming";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "../../../../packages/ui/primitives/Button";
import { ApplicationSdkError } from "../runtime/applicationCompatibility";
import { Linking, StyleSheet, View, useWindowDimensions } from "react-native";
import { AmbientFill } from "../../../../packages/ui/chrome";
import { parseSharedLink, type SharedLink } from "./deepLinks";
import { watchClipboardShares } from "./clipboardShares";
import NativePluginHost from "../NativePluginHost";
import { openCreationComposer, type CreationIntent } from "./creationComposer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Screen,
  ScreenEdge,
  useKeyboardOpen,
} from "../../../../packages/ui/edge";
import {
  NavigationContainer,
  DefaultTheme,
  type NavigationState,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import type { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";
import { TabBar, type ShellTabId } from "./TabBar";

import { FeedScreen } from "./feed/FeedScreen";
import { ApplicationFeedScreen } from "./ApplicationFeedScreen";
import { backFromApplicationExperience } from "./applicationExperienceNavigation";
import {
  FeedChromeProvider,
  useFeedChrome,
  SHELL_BOTTOM_PADDING,
} from "./feed/FeedChrome";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
} from "react-native-reanimated";
import { type AppEntry } from "./catalog";
import type { MarketApplication } from "./market";
import { fetchMarketDetail, isApplicationInstalled } from "./market";
import {
  applicationContext,
  setApplicationPostHandlers,
} from "../../../../packages/app-sdk/src/runtime";
import {
  ProfileDrawer,
  showProfileDrawer,
  useProfileDrawer,
} from "./ProfileDrawer";
import { requireAccount, currentAccountId, cachedAccountId } from "./account";
import { readShellValue, removeShellValue } from "./shellStorage";
import { ThemeContext, useTheme, type ThemeMode, type ThemePreference } from "../../../../packages/ui/theme";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { AsyncRouteScreen } from "./AsyncRouteScreen";
import { cachedFeature, openFeature } from "../../../../packages/features/src/registry";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";

import { openApplicationWorkshop } from "./workshopNavigation";
import type { UserPost } from "./feed/userPosts";
import type { UserPostDraft } from "../../../../packages/app-sdk/src/index";
import {
  shareApplicationPost,
  validatePostDraft,
} from "./feed/applicationSharing";
import type { PublicAuthor } from "./feed/userPosts";
import { fetchPostDetail, type PostDetail } from "./feed/userPosts";
import type { Notice } from "./feed/notifications";
import type { RelationKind } from "./social/api";

export type TabParamList = {
  feed: undefined;
  market: undefined;
  notifications: undefined;
  mine: undefined;
};


import { ShellTabScene } from "./ShellTabScene";
import { shellNavigationRef } from "./navigationRef";
import { lazyScreen } from "./lazyScreen";

const MyApplicationsScreen = lazyScreen(() => (require("./MyApplicationsScreen") as typeof import("./MyApplicationsScreen")).MyApplicationsScreen, true);
const MarketScreen = lazyScreen(() => (require("./MarketScreen") as typeof import("./MarketScreen")).MarketScreen, true);
const MarketDetailScreen = lazyScreen(() => (require("./MarketDetailScreen") as typeof import("./MarketDetailScreen")).MarketDetailScreen, true);
const MarketPublicationScreen = lazyScreen(() => (require("./MarketDetailScreen") as typeof import("./MarketDetailScreen")).MarketPublicationScreen, true);
const MineScreen = lazyScreen(() => (require("./MineScreen") as typeof import("./MineScreen")).MineScreen, true);
const AccountScreen = lazyScreen(() => (require("./AccountScreen") as typeof import("./AccountScreen")).AccountScreen, true);
const ProvidersScreen = lazyScreen(() => (require("./ProvidersScreen") as typeof import("./ProvidersScreen")).ProvidersScreen, true);
const AppInfoScreen = lazyScreen(() => (require("./AppInfoScreen") as typeof import("./AppInfoScreen")).AppInfoScreen, true);
const AppearanceScreen = lazyScreen(() => (require("./AppearanceScreen") as typeof import("./AppearanceScreen")).AppearanceScreen, true);
const PublicationScreen = lazyScreen(() => (require("./PublicationScreen") as typeof import("./PublicationScreen")).PublicationScreen, true);
const MyProfileScreen = lazyScreen(() => (require("./MyProfileScreen") as typeof import("./MyProfileScreen")).MyProfileScreen, true);
const PostDetailScreen = lazyScreen(() => (require("./feed/PostDetailScreen") as typeof import("./feed/PostDetailScreen")).PostDetailScreen, true);
const AuthorProfileScreen = lazyScreen(() => (require("./feed/AuthorProfileScreen") as typeof import("./feed/AuthorProfileScreen")).AuthorProfileScreen, true);
const NotificationsScreen = lazyScreen(() => (require("./feed/NotificationsScreen") as typeof import("./feed/NotificationsScreen")).NotificationsScreen, true);
const ConnectionsScreen = lazyScreen(() => (require("./social/ConnectionsScreen") as typeof import("./social/ConnectionsScreen")).ConnectionsScreen, true);
const ChatScreen = lazyScreen(() => (require("./social/ChatScreen") as typeof import("./social/ChatScreen")).ChatScreen, true);
const JollyProgressScreen = lazyScreen(() => (require("./jolly/ProgressScreen") as typeof import("./jolly/ProgressScreen")).default, true);


export type RootParamList = {
  sharedApplication: { appId: string };
  applicationLink: { appId: string };
  noticePost: { postId: string; commentId?: string };
  workshopProgress: { appId?: string; title?: string; ownerId: string };
  tabs: NavigatorScreenParams<TabParamList> | undefined;
  providers: undefined;
  info: undefined;
  appearance: undefined;
  bundle: { id: string };
  marketDetail: { item: MarketApplication };
  marketPublication: { item: MarketApplication };
  myApps: undefined;
  discovery: undefined;
  account: undefined;
  composePost:
    | {
        application?: MarketApplication;
        draft?: UserPostDraft;
        mode?: "post" | "create";
        creation?: CreationIntent;
      }
    | undefined;
  postDetail: {
    post: UserPost;
    commentId?: string;
    initialDetail?: PostDetail;
  };
  notifications: undefined;
  authorProfile: { author: PublicAuthor };
  connections: { author: PublicAuthor; kind: RelationKind };
  chat: { peer: PublicAuthor };
};

export { shellNavigationRef } from "./navigationRef";
const AUTHOR_NAVIGATION_INTENT = "author-navigation-intent";
function openAuthor(author: PublicAuthor) {
  if (shellNavigationRef.isReady()) {
    // Stop queued preheating as soon as the user taps, before native events arrive.
    beginRouteTransition(AUTHOR_NAVIGATION_INTENT);
    shellNavigationRef.navigate("authorProfile", { author });
  }
}

function openConnections(author: PublicAuthor, kind: RelationKind) {
  if (shellNavigationRef.isReady()) shellNavigationRef.navigate("connections", { author, kind });
}
function openChat(peer: PublicAuthor) {
  const open = () => { if (shellNavigationRef.isReady() && cachedAccountId() !== peer.id) shellNavigationRef.navigate("chat", { peer }); };
  if (cachedAccountId()) open();
  else void requireAccount().then(allowed => { if (allowed) open(); });
}

async function openNotice(notice: Notice) {
  if (
    notice.kind === "work-success" ||
    notice.kind === "work-failure" ||
    notice.kind === "work-submitted"
  ) {
    if (!notice.appId) throw new Error("这条制作通知缺少作品信息");
    await openApplicationWorkshop(
      notice.appId,
      notice.postPreview,
      false,
      false
    );
    return true;
  }
  if (!shellNavigationRef.isReady()) return false;
  shellNavigationRef.navigate("noticePost", { postId: notice.postId, commentId: notice.commentId || undefined });
  return true;
}

function NotificationsTab({
  onOpen,
}: {
  onOpen: (notice: Notice) => Promise<boolean>;
}) {
  const { gesture, notificationActive, notificationPosition } =
    useProfileDrawer();
  return (
    <NotificationsScreen
      drawerGesture={gesture}
      drawerPaging={{
        active: notificationActive,
        position: notificationPosition,
      }}
      onOpen={onOpen}
      onMessage={openChat}
    />
  );
}

const Stack = createNativeStackNavigator<RootParamList>();
const Tabs = createMaterialTopTabNavigator<TabParamList>();
export function openShellTab(id: ShellTabId) {
  if (!shellNavigationRef.isReady()) return;
  shellNavigationRef.navigate("tabs", { screen: id });
}
function openPublication(mode: "post" | "create" = "create") {
  const open = () => {
    if (shellNavigationRef.isReady()) shellNavigationRef.navigate("composePost", { mode });
  };
  if (cachedAccountId()) open();
  else void requireAccount().then(allowed => { if (allowed) open(); });
}
export async function openPublicMarketApplication(appId: string) {
  if (!shellNavigationRef.isReady()) return;
  if (cachedFeature(appId)) {
    shellNavigationRef.navigate("bundle", { id: appId });
    return;
  }
  shellNavigationRef.navigate("applicationLink", { appId });
}

export async function openShellBundle(id: string) {
  if (!shellNavigationRef.isReady()) return false;
  if (id === bootstrap.defaultApplication) {
    const ownerId = cachedAccountId();
    if (!ownerId) return false;
    const appId = applicationContext(id).storage.get("workshopTarget") || undefined;
    shellNavigationRef.navigate("workshopProgress", { appId, ownerId });
  } else {
    shellNavigationRef.navigate("bundle", { id });
  }
  return true;
}

function goBack() {
  if (shellNavigationRef.isReady() && shellNavigationRef.canGoBack()) {
    shellNavigationRef.goBack();
  } else {
    if (!backFromApplicationExperience()) openShellTab("feed");
  }
}

/**
 * 朋友们自己的页面在功能包里，够不着壳的导航，于是通过这个键来请求：
 * 写入 `{"action":"tab","tab":"agent"}`、`{"action":"open","id":"jolly"}` 或 `{"action":"back"}`，
 * 再带一个 `at` 时间戳让每次写入都不相同。壳收到后替它们跳转。
 */
export const SHELL_NAV_REQUEST = "shell.nav.request";

const SHELL_TAB_IDS: readonly string[] = [
  "feed",
  "market",
  "notifications",
  "mine",
];

function handleShellRequest(raw: string | undefined) {
  if (!raw) return;
  try {
    const request = JSON.parse(raw) as {
      action?: string;
      tab?: string;
      id?: string;
    };
    console.log(
      "shell request",
      request.action,
      request.tab ?? request.id ?? ""
    );
    if (request.action === "account") shellNavigationRef.navigate("account");
    else if (request.action === "providers")
      shellNavigationRef.navigate("providers");
    else if (request.action === "back") goBack();
    else if (request.action === "tab" && request.tab === "agent")
      applicationContext(bootstrap.defaultApplication).navigation.create();
    else if (
      request.action === "tab" &&
      request.tab &&
      SHELL_TAB_IDS.includes(request.tab)
    )
      openShellTab(request.tab as ShellTabId | "mine");
    else if (request.action === "open" && request.id)
      openShellBundle(request.id);
  } catch (error) {
    console.log(
      "shell request unreadable",
      error instanceof Error ? error.message : error
    );
  }
}

function ApplicationRecovery({ error, onCheckUpdates }: { error: Error; onCheckUpdates: () => Promise<boolean> }) {
  const [busy, setBusy] = useState(false);
  if (!(error instanceof ApplicationSdkError)) return null;
  if (error.action === "update-application") return <Button label="管理应用版本" onPress={() => shellNavigationRef.navigate("discovery")} />;
  return <Button label="检查生花更新" busy={busy} onPress={() => {
    if (busy) return;
    setBusy(true);
    void onCheckUpdates().catch(cause => Toast.show({ type: "error", text1: "检查更新失败", text2: cause instanceof Error ? cause.message : "请稍后重试" })).finally(() => setBusy(false));
  }} />;
}

function BundlePage({ id, render, onCheckUpdates }: {
  id: string;
  onCheckUpdates: () => Promise<boolean>;
  render: (id: string, onBack: () => void) => ReactNode;
}) {

  // The runtime cache already enforces account access and quarantines failed packages.
  // Reopening an evaluated package must not replay the entrance loading state.
  const cachedOnEntry = useRef(Boolean(cachedFeature(id))).current;
  if (cachedOnEntry && cachedFeature(id))
    return <View style={styles.feature}>{render(id, goBack)}</View>;
  return <AsyncRouteScreen title="打开应用" onBack={goBack} load={() => openFeature(id)} renderErrorAction={error => <ApplicationRecovery error={error} onCheckUpdates={onCheckUpdates} />}>
    {() => <View style={styles.feature}>{render(id, goBack)}</View>}
  </AsyncRouteScreen>;
}

function MarketDetailPage({ item, onOpen }: {
  item: MarketApplication;
  onOpen: (id: string) => Promise<boolean>;
}) {
  return <MarketDetailScreen
    item={item}
    onBack={goBack}
    onOpen={onOpen}
    onModify={(manifest, ownerId, fork) => openCreationComposer({
      appId: manifest.appId, title: manifest.appName, releaseId: manifest.releaseId, ownerId, fork,
    })}
    onSharePost={application => shellNavigationRef.navigate("composePost", { application })}
    onAuthor={openAuthor}
    onPublication={() => shellNavigationRef.navigate("marketPublication", { item })}
  />;
}

function ShellTabBar({ state, jumpTo }: MaterialTopTabBarProps) {
  const active = state.routes[state.index]?.name ?? "feed";
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = theme.colors;
  const keyboard = useKeyboardOpen();
  const { hidden, tabHeight } = useFeedChrome();
  const { height: windowHeight } = useWindowDimensions();
  const [barHeight, setBarHeight] = useState(0);
  const motion = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: active === "market" ? hidden.value * tabHeight.value : 0 },
      ],
    }),
    [active]
  );
  return (
    <Animated.View
      onLayout={(event) => {
        tabHeight.value = event.nativeEvent.layout.height;
        setBarHeight(event.nativeEvent.layout.height);
      }}
      style={[
        {
          paddingTop: 8,
          paddingBottom: keyboard
            ? 0
            : Math.max(SHELL_BOTTOM_PADDING, insets.bottom),
        },
        active === "market" && {
          experimental_backgroundImage: `linear-gradient(180deg, ${colors.canvas}00 0%, ${colors.canvas}E6 55%, ${colors.canvas} 100%)`,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
        },
        motion,
      ]}
    >
      {active !== "market" ? <AmbientFill offset={windowHeight - barHeight} /> : null}
      <ThemeContext.Provider value={theme}>
      <TabBar
        activeId={active}
        onCompose={() => openPublication()}
        onChange={(id) => {
          const route = state.routes.find((item) => item.name === id);
          if (route) {
            jumpTo(route.key);
          }
        }}
      />
      </ThemeContext.Provider>
    </Animated.View>
  );
}

export type ShellNavigatorProps = {
  onReady: () => void;
  mode: ThemeMode;
  listed: AppEntry[];
  onOpenBundle: (id: string) => Promise<boolean>;
  /** 在动态里对某位朋友说一句：去工坊，带着 TA 的名字起个头。 */
  onReplyToFriend: (id: string) => void;
  onCheckUpdates: () => Promise<boolean>;
  onMode: (mode: ThemePreference) => void;
  renderBundle: (id: string, onBack: () => void) => ReactNode;
};

export function ShellNavigator(props: ShellNavigatorProps) {
  markStartup("navigator-render-start");
  const pendingLink = useRef<{ target: SharedLink; url?: string }>();
  const linkOpened = useRef(false);
  function flushSharedLink() {
    const pending = pendingLink.current;
    if (!pending || !shellNavigationRef.isReady()) return;
    const link = pending.target;
    pendingLink.current = undefined;
    linkOpened.current = true;
    if (link.kind === "post") shellNavigationRef.navigate("noticePost", { postId: link.id });
    else shellNavigationRef.navigate("sharedApplication", { appId: link.id });
    if (pending.url) void NativePluginHost.call("shell", "consumeLaunchLink", JSON.stringify({ url: pending.url })).catch(() => {});
  }
  useEffect(() => {
    let live = true;
    let receivedEvent = false;
    const clipboard = watchClipboardShares(target => {
      if (!live) return;
      pendingLink.current = { target };
      flushSharedLink();
    });
    const receive = (url: string) => {
      const link = parseSharedLink(url);
      if (!live || !link) return;
      clipboard.directLinkReceived();
      pendingLink.current = { target: link, url };
      flushSharedLink();
    };
    const subscription = Linking.addEventListener("url", event => { receivedEvent = true; receive(event.url); });
    void Linking.getInitialURL().then(url => { if (url && !receivedEvent) receive(url); }).catch(() => {}).finally(() => { if (live) clipboard.start(); });
    return () => { live = false; subscription.remove(); clipboard.stop(); };
  }, []);
  const reduceMotion = useReducedMotion();
  const previous = useRef({ label: "", depth: 1 });
  const { colors } = useTheme();
  const theme = useMemo(() => ({
    ...DefaultTheme,
    dark: props.mode === "dark",
    colors: {
      ...DefaultTheme.colors,
      background: colors.canvas,
      card: colors.canvas,
      text: colors.ink1,
      border: colors.line,
      primary: colors.accent,
    },
  }), [colors, props.mode]);

  useEffect(
    () => subscribePackageValue(SHELL_NAV_REQUEST, handleShellRequest),
    []
  );
  useEffect(() => {
    setApplicationPostHandlers(shareApplicationPost, async (_appId, draft) => {
      validatePostDraft(draft);
      if (!(await requireAccount())) throw new Error("请登录后分享");
      if (!shellNavigationRef.isReady()) throw new Error("分享入口尚未就绪");
      shellNavigationRef.navigate("composePost", { draft });
    });
  }, []);

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
    } else if (depth < previous.current.depth)
      console.log("route pop", label, detail);
    else console.log("route push", label, detail, "depth", depth);
    previous.current = { label: key, depth };
  }

  return (
    <FeedChromeProvider>
      <NavigationContainer
        ref={shellNavigationRef}
        theme={theme}
        onStateChange={onStateChange}
        onReady={() => {
          props.onReady();
          flushSharedLink();
          void (async () => {
            const rollback = await readShellValue(
              "application.rollback.notice"
            );
            removeShellValue("application.rollback.notice");
            if (rollback)
              Toast.show({
                type: "error",
                text1: "应用更新已回退",
                text2: rollback,
              });
            const workshop = await readShellValue(
              "application.workshopAfterReload"
            );
            removeShellValue("application.workshopAfterReload");
            if (workshop && !linkOpened.current) {
              try {
                const request = JSON.parse(workshop);
                if (
                  request.ownerId === (await currentAccountId()) && !linkOpened.current &&
                  /^[a-z][a-z0-9-]{0,63}$/.test(request.target)
                ) {
                  const context = applicationContext(
                    bootstrap.defaultApplication
                  );
                  context.storage.set("workshopTarget", request.target);
                  context.storage.set("openWorkshop", String(Date.now()));
                }
              } catch {
                /* Ignore an incomplete handoff. */
              }
            }
            const raw = await readShellValue("application.openAfterReload");
            removeShellValue("application.openAfterReload");
            if (!raw || linkOpened.current) return;
            try {
              const request = JSON.parse(raw);
              if (
                request.ownerId === (await currentAccountId()) && !linkOpened.current &&
                /^[a-z][a-z0-9-]{0,63}$/.test(request.appId)
              )
                openShellBundle(request.appId);
            } catch {
              /* Ignore an incomplete navigation request. */
            }
          })();
        }}
      >
        <Stack.Navigator
          screenListeners={({ route }) => ({
            transitionStart: () => {
              beginRouteTransition(route.key);
              if (route.name === "authorProfile") endRouteTransition(AUTHOR_NAVIGATION_INTENT);
            },
            transitionEnd: () => endRouteTransition(route.key),
          })}
          screenOptions={{
            headerShown: false,
            animation: reduceMotion ? "none" : "slide_from_right",
            animationDuration: 220,
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          <Stack.Screen name="tabs" options={{ freezeOnBlur: true }}>
            {() => (
              <ProfileDrawer
                render={(close, dismiss) => (
                  <MineScreen
                    drawer
                    onClose={close}
                    onProfile={() => {
                      dismiss();
                      openShellTab("mine");
                    }}
                    onAccount={() => {
                      dismiss();
                      shellNavigationRef.navigate("account");
                    }}
                    mode={props.mode}
                    onProviders={() => {
                      dismiss();
                      shellNavigationRef.navigate("providers");
                    }}
                    onInfo={() => {
                      dismiss();
                      shellNavigationRef.navigate("info");
                    }}
                    onCheckUpdates={props.onCheckUpdates}
                    onAppearance={() => {
                      dismiss();
                      shellNavigationRef.navigate("appearance");
                    }}
                  />
                )}
              >
                <ScreenEdge bottom={false}>
                  <Tabs.Navigator
                    screenListeners={{ swipeStart: () => beginRouteTransition("shell-tabs"), swipeEnd: () => endRouteTransition("shell-tabs") }}
                    backBehavior="none"
                    tabBarPosition="bottom"
                    tabBar={(tabProps) => <ShellTabBar {...tabProps} />}
                    screenOptions={{
                      swipeEnabled: false,
                      lazy: true,
                      lazyPreloadDistance: 0,
                      animationEnabled: false,
                      sceneStyle: { backgroundColor: colors.canvas },
                    }}
                  >
                    <Tabs.Screen name="feed">
                      {() => (
                        <ShellTabScene immediate>
                          <ApplicationFeedScreen
                            renderApplication={props.renderBundle}
                            onProfile={showProfileDrawer}
                            onSearch={() => shellNavigationRef.navigate("discovery")}
                            onAuthor={openAuthor}
                            onDetail={item => shellNavigationRef.navigate("marketDetail", { item })}
                            onShare={application => shellNavigationRef.navigate("composePost", { application })}
                            onRemix={item => openCreationComposer({ appId: item.manifest.appId, title: item.manifest.appName, releaseId: item.manifest.releaseId, fork: true })}
                          />
                        </ShellTabScene>
                      )}
                    </Tabs.Screen>
                    <Tabs.Screen name="market">
                      {() => (
                        <ShellTabScene>
                          {() => <FeedScreen
                            onAuthor={openAuthor}
                            onApplication={openPublicMarketApplication}
                            onPost={post => shellNavigationRef.navigate("postDetail", { post })}
                            onCompose={() => openPublication("post")}
                          />}
                        </ShellTabScene>
                      )}
                    </Tabs.Screen>
                    <Tabs.Screen name="notifications">
                      {() => (
                        <ShellTabScene>
                          {() => <NotificationsTab onOpen={openNotice} />}
                        </ShellTabScene>
                      )}
                    </Tabs.Screen>
                    <Tabs.Screen name="mine">
                      {() => (
                        <ShellTabScene>
                          {() => <MyProfileScreen
                            onConnections={openConnections}
                            onAccount={() =>
                              shellNavigationRef.navigate("account")
                            }
                            onPost={(post) =>
                              shellNavigationRef.navigate("postDetail", {
                                post,
                              })
                            }
                            onApplication={openPublicMarketApplication}
                            onDetail={(item) =>
                              shellNavigationRef.navigate("marketDetail", {
                                item,
                              })
                            }
                            onManagePublication={(item) =>
                              shellNavigationRef.navigate("marketPublication", {
                                item,
                              })
                            }
                            onOpen={props.onOpenBundle}
                            onCreate={() => openPublication("create")}
                            onSharePost={(application) =>
                              shellNavigationRef.navigate("composePost", {
                                application,
                              })
                            }
                          />}
                        </ShellTabScene>
                      )}
                    </Tabs.Screen>
                  </Tabs.Navigator>
                </ScreenEdge>
              </ProfileDrawer>
            )}
          </Stack.Screen>
          <Stack.Screen name="discovery">
            {() => <MarketScreen onBack={goBack} onOpen={props.onOpenBundle} onAuthor={openAuthor} onDetail={item => shellNavigationRef.navigate("marketDetail", { item })} onCreate={() => openCreationComposer()} />}
          </Stack.Screen>
          <Stack.Screen name="applicationLink">
            {({ route }) => <AsyncRouteScreen key={route.params.appId} title="打开应用" onBack={goBack} renderErrorAction={error => <ApplicationRecovery error={error} onCheckUpdates={props.onCheckUpdates} />} cacheKey={`link:${route.params.appId}:${isApplicationInstalledSync(route.params.appId) ? "installed" : "public"}`}
              load={async () => {
                if (await isApplicationInstalled(route.params.appId)) {
                  await openFeature(route.params.appId);
                  return null;
                }
                return fetchMarketDetail(route.params.appId);
              }}>
              {item => item
                ? <MarketDetailPage item={item} onOpen={props.onOpenBundle} />
                : <BundlePage id={route.params.appId} render={props.renderBundle} onCheckUpdates={props.onCheckUpdates} />}
            </AsyncRouteScreen>}
          </Stack.Screen>
          <Stack.Screen name="noticePost">
            {({ route }) => <AsyncRouteScreen key={`${route.params.postId}:${route.params.commentId ?? ""}`} title="动态" onBack={goBack} cacheKey={`post:${route.params.postId}:${route.params.commentId ?? ""}`}
              load={() => fetchPostDetail(route.params.postId, undefined, route.params.commentId)}>
              {detail => <PostDetailScreen initialPost={detail.post} initialDetail={detail} initialCommentId={route.params.commentId}
                onBack={goBack} onApplication={openPublicMarketApplication} onAuthor={openAuthor} />}
            </AsyncRouteScreen>}
          </Stack.Screen>
          <Stack.Screen name="marketDetail">
            {({ route }) => <MarketDetailPage item={route.params.item} onOpen={props.onOpenBundle} />}
          </Stack.Screen>
          <Stack.Screen name="sharedApplication">
            {({ route }) => <AsyncRouteScreen key={route.params.appId} title="作品详情" onBack={goBack} cacheKey={`shared-application:${route.params.appId}`}
              load={() => fetchMarketDetail(route.params.appId)}>
              {item => <MarketDetailPage item={item} onOpen={props.onOpenBundle} />}
            </AsyncRouteScreen>}
          </Stack.Screen>
          <Stack.Screen name="marketPublication">
            {({ route }) => (
              <MarketPublicationScreen
                item={route.params.item}
                onBack={goBack}
                onOpen={props.onOpenBundle}
                onAuthor={openAuthor}
                onModify={(manifest, ownerId, fork) =>
                  openCreationComposer({
                    appId: manifest.appId,
                    title: manifest.appName,
                    releaseId: manifest.releaseId,
                    ownerId,
                    fork,
                  })
                }
                onSharePost={(application) =>
                  shellNavigationRef.navigate("composePost", { application })
                }
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="myApps">
            {() => (
              <MyApplicationsScreen
                onManagePublication={(item) =>
                  shellNavigationRef.navigate("marketPublication", { item })
                }
                onOpen={props.onOpenBundle}
                onBack={goBack}
                onDetail={(item) =>
                  shellNavigationRef.navigate("marketDetail", { item })
                }
                onCreate={() => {
                  void requireAccount().then((allowed) => {
                    if (allowed)
                      applicationContext(
                        bootstrap.defaultApplication
                      ).navigation.create();
                  });
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="account"
            options={{ animation: "slide_from_right", animationDuration: 220 }}
          >
            {() => <AccountScreen onBack={goBack} />}
          </Stack.Screen>
          <Stack.Screen name="workshopProgress">
            {({ route }) => (
              <JollyProgressScreen
                key={`${route.params.ownerId}.${route.params.appId}`}
                appId={route.params.appId}
                title={route.params.title}
                scope={route.params.ownerId}
                onBack={goBack}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="composePost">
            {({ route }) => (
              <PublicationScreen
                onBack={goBack}
                onCreate={async (input) => {
                  const { submitCreationPrompt } = require("./creationDraft") as typeof import("./creationDraft");
                  return await submitCreationPrompt(
                    input,
                    route.params?.creation
                  );
                }}
                onSubmitting={() => {
                  if (shellNavigationRef.getCurrentRoute()?.key !== route.key)
                    return;
                  goBack();
                }}
                initialMode={route.params?.mode}
                creation={route.params?.creation}
                initialApplication={route.params?.application}
                initialDraft={route.params?.draft}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="postDetail">
            {({ route }) => (
              <PostDetailScreen
                key={`${route.params.post.id}:${route.params.commentId ?? ""}`}
                initialPost={route.params.post}
                initialCommentId={route.params.commentId}
                initialDetail={route.params.initialDetail}
                onBack={goBack}
                onApplication={openPublicMarketApplication}
                onAuthor={openAuthor}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="notifications">
            {() => <NotificationsScreen onBack={goBack} onOpen={openNotice} onMessage={openChat} />}
          </Stack.Screen>
          <Stack.Screen name="authorProfile">
            {({ route }) => (
              <AuthorProfileScreen
                key={route.params.author.id}
                initialAuthor={route.params.author}
                onConnections={openConnections}
                onMessage={openChat}
                onBack={goBack}
                onPost={(post) =>
                  shellNavigationRef.navigate("postDetail", { post })
                }
                onApplication={openPublicMarketApplication}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="connections">
            {({ route }) => <ConnectionsScreen key={`${route.params.author.id}:${route.params.kind}`} author={route.params.author} initialKind={route.params.kind} onBack={goBack} onAuthor={openAuthor} />}
          </Stack.Screen>
          <Stack.Screen name="chat">
            {({ route }) => <ChatScreen key={route.params.peer.id} peer={route.params.peer} onBack={goBack} />}
          </Stack.Screen>
          <Stack.Screen name="providers">
            {() => <ProvidersScreen onBack={goBack} />}
          </Stack.Screen>

          <Stack.Screen name="appearance">
            {() => (
              <AppearanceScreen onBack={goBack} />
            )}
          </Stack.Screen>
          <Stack.Screen name="info">
            {() => <AppInfoScreen onBack={goBack} />}
          </Stack.Screen>
          <Stack.Screen name="bundle" getId={({ params }) => params.id}>
            {({ route }) => (
              <BundlePage id={route.params.id} render={props.renderBundle} onCheckUpdates={props.onCheckUpdates} />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </FeedChromeProvider>
  );
}

const styles = StyleSheet.create({
  feature: {
    flex: 1,
  },
});
