import { isApplicationInstalledSync } from "./market";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { ApplicationManifest } from "../runtime/applications";
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
  createNavigationContainerRef,
  type NavigationState,
  type NavigatorScreenParams,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import type { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";
import { TabBar, type ShellTabId } from "./TabBar";

import { FeedScreen } from "./feed/FeedScreen";
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
import { MyApplicationsScreen } from "./MyApplicationsScreen";
import { MarketScreen } from "./MarketScreen";
import {
  MarketDetailScreen,
  MarketPublicationScreen,
} from "./MarketDetailScreen";
import type { MarketApplication } from "./market";
import { fetchPublicMarketApplication, isApplicationInstalled } from "./market";
import {
  applicationContext,
  setApplicationPostHandlers,
} from "../../../../packages/app-sdk/src/runtime";
import {
  ProfileDrawer,
  showProfileDrawer,
  useProfileDrawer,
} from "./ProfileDrawer";
import { MineScreen } from "./MineScreen";
import { requireAccount, currentAccountId, cachedAccountId } from "./account";
import { readShellValue, removeShellValue } from "./shellStorage";
import { AccountScreen } from "./AccountScreen";
import { ProvidersScreen } from "./ProvidersScreen";
import { AppInfoScreen } from "./AppInfoScreen";
import { AppearanceScreen } from "./AppearanceScreen";
import { useTheme, type ThemeMode, type ThemePreference } from "../../../../packages/ui/theme";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { AsyncRouteScreen } from "./AsyncRouteScreen";
import { cachedFeature, openFeature } from "../../../../packages/features/src/registry";
import Toast from "react-native-toast-message";
import { PublicationScreen } from "./PublicationScreen";
import { MyProfileScreen } from "./MyProfileScreen";
import { submitCreationPrompt } from "./creationDraft";
import { openApplicationWorkshop } from "./workshopNavigation";
import { PostDetailScreen } from "./feed/PostDetailScreen";
import type { UserPost } from "./feed/userPosts";
import type { UserPostDraft } from "../../../../packages/app-sdk/src/index";
import {
  shareApplicationPost,
  validatePostDraft,
} from "./feed/applicationSharing";
import { AuthorProfileScreen } from "./feed/AuthorProfileScreen";
import type { PublicAuthor } from "./feed/userPosts";
import { fetchPostDetail, type PostDetail } from "./feed/userPosts";
import type { Notice } from "./feed/notifications";
import { NotificationsScreen } from "./feed/NotificationsScreen";
import { ConnectionsScreen } from "./social/ConnectionsScreen";
import { ChatScreen } from "./social/ChatScreen";
import type { RelationKind } from "./social/api";

export type TabParamList = {
  feed: undefined;
  market: undefined;
  notifications: undefined;
  mine: undefined;
};

import JollyProgressScreen from "./jolly/ProgressScreen";
import { ShellTabScene, prioritizeShellTab, setShellTabWarmupActive } from "./ShellTabScene";

export type RootParamList = {
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

export const shellNavigationRef = createNavigationContainerRef<RootParamList>();
function openAuthor(author: PublicAuthor) {
  if (shellNavigationRef.isReady())
    shellNavigationRef.navigate("authorProfile", { author });
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
function openPublication(mode: "post" | "create" = "post") {
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
    openShellTab("feed");
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

function BundlePage({ id, render }: {
  id: string;
  render: (id: string, onBack: () => void) => ReactNode;
}) {

  // The runtime cache already enforces account access and quarantines failed packages.
  // Reopening an evaluated package must not replay the entrance loading state.
  const cachedOnEntry = useRef(Boolean(cachedFeature(id))).current;
  if (cachedOnEntry && cachedFeature(id))
    return <View style={styles.feature}>{render(id, goBack)}</View>;
  return <AsyncRouteScreen title="打开应用" onBack={goBack} load={() => openFeature(id)}>
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
      appId: manifest.appId, title: manifest.title, releaseId: manifest.releaseId, ownerId, fork,
    })}
    onSharePost={application => shellNavigationRef.navigate("composePost", { application })}
    onAuthor={openAuthor}
    onPublication={() => shellNavigationRef.navigate("marketPublication", { item })}
  />;
}

function ShellTabBar({ state, jumpTo }: MaterialTopTabBarProps) {
  const active = state.routes[state.index]?.name ?? "feed";
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const keyboard = useKeyboardOpen();
  const { hidden, tabHeight } = useFeedChrome();
  const motion = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: active === "feed" ? hidden.value * tabHeight.value : 0 },
      ],
    }),
    [active]
  );
  return (
    <Animated.View
      onLayout={(event) => {
        tabHeight.value = event.nativeEvent.layout.height;
      }}
      style={[
        {
          backgroundColor: colors.canvas,
          paddingBottom: keyboard
            ? 0
            : Math.max(SHELL_BOTTOM_PADDING, insets.bottom),
        },
        active === "feed" && {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 20,
        },
        motion,
      ]}
    >
      <TabBar
        activeId={active}
        onCompose={() => openPublication()}
        onChange={(id) => {
          const route = state.routes.find((item) => item.name === id);
          if (route) {
            prioritizeShellTab();
            jumpTo(route.key);
          }
        }}
      />
    </Animated.View>
  );
}

export type ShellNavigatorProps = {
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
  const reduceMotion = useReducedMotion();
  const installedIds = useMemo(
    () => props.listed.map((item) => item.id),
    [props.listed]
  );
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
    setShellTabWarmupActive(top?.name === "tabs");
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
            if (workshop) {
              try {
                const request = JSON.parse(workshop);
                if (
                  request.ownerId === (await currentAccountId()) &&
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
            if (!raw) return;
            try {
              const request = JSON.parse(raw);
              if (
                request.ownerId === (await currentAccountId()) &&
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
                    backBehavior="none"
                    tabBarPosition="bottom"
                    tabBar={(tabProps) => <ShellTabBar {...tabProps} />}
                    screenOptions={{
                      swipeEnabled: false,
                      lazy: false,
                      animationEnabled: false,
                      sceneStyle: { backgroundColor: colors.canvas },
                    }}
                  >
                    <Tabs.Screen name="feed">
                      {() => (
                        <ShellTabScene>
                          <FeedScreen
                            onAuthor={openAuthor}
                            onApplication={openPublicMarketApplication}
                            onProfile={showProfileDrawer}
                            onPost={(post) =>
                              shellNavigationRef.navigate("postDetail", {
                                post,
                              })
                            }
                            onCompose={() => openPublication()}
                          />
                        </ShellTabScene>
                      )}
                    </Tabs.Screen>
                    <Tabs.Screen name="market">
                      {() => (
                        <ShellTabScene>
                          <MarketScreen
                            onOpen={props.onOpenBundle}
                            onAuthor={openAuthor}
                            onDetail={(item) =>
                              shellNavigationRef.navigate("marketDetail", {
                                item,
                              })
                            }
                            onCreate={() => openCreationComposer()}
                          />
                        </ShellTabScene>
                      )}
                    </Tabs.Screen>
                    <Tabs.Screen name="notifications">
                      {() => (
                        <ShellTabScene>
                          <NotificationsTab onOpen={openNotice} />
                        </ShellTabScene>
                      )}
                    </Tabs.Screen>
                    <Tabs.Screen name="mine">
                      {() => (
                        <ShellTabScene>
                          <MyProfileScreen
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
                          />
                        </ShellTabScene>
                      )}
                    </Tabs.Screen>
                  </Tabs.Navigator>
                </ScreenEdge>
              </ProfileDrawer>
            )}
          </Stack.Screen>
          <Stack.Screen name="applicationLink">
            {({ route }) => <AsyncRouteScreen key={route.params.appId} title="打开应用" onBack={goBack} cacheKey={`link:${route.params.appId}:${isApplicationInstalledSync(route.params.appId) ? "installed" : "public"}`}
              load={async () => {
                if (await isApplicationInstalled(route.params.appId)) {
                  await openFeature(route.params.appId);
                  return null;
                }
                return fetchPublicMarketApplication(route.params.appId);
              }}>
              {item => item
                ? <MarketDetailPage item={item} onOpen={props.onOpenBundle} />
                : <BundlePage id={route.params.appId} render={props.renderBundle} />}
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
                    title: manifest.title,
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
                  return await submitCreationPrompt(
                    input,
                    route.params?.creation
                  );
                }}
                onCreated={() => {
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
              <BundlePage id={route.params.id} render={props.renderBundle} />
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
