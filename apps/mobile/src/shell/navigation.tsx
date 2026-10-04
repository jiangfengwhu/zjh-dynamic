const bootstrap = require("../../../../tools/applications/bootstrap.json");
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { ApplicationManifest } from "../runtime/applications";
import { ApplicationFeedbackScreen } from "./ApplicationFeedbackScreen";
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
import { pixelTheme } from "./feed/pixelTheme";
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
import { MarketDetailScreen } from "./MarketDetailScreen";
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
import { requireAccount, currentAccountId } from "./account";
import { readShellValue, removeShellValue } from "./shellStorage";
import { AccountScreen } from "./AccountScreen";
import { ProvidersScreen } from "./ProvidersScreen";
import { AppInfoScreen } from "./AppInfoScreen";
import { AppearanceScreen } from "./AppearanceScreen";
import {
  palettes,
  useTheme,
  type ThemeMode,
} from "../../../../packages/ui/theme";
import { subscribePackageValue } from "../../../../packages/ui/packageLink";
import { openFeature } from "../../../../packages/features/src/registry";
import Toast from "react-native-toast-message";
import { PublicationScreen } from "./PublicationScreen";
import { MyProfileScreen } from "./MyProfileScreen";
import {
  openApplicationWorkshop,
  openCreationRequest,
} from "./workshopNavigation";
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

export type TabParamList = {
  feed: undefined;
  market: undefined;
  notifications: undefined;
  mine: undefined;
};

export type RootParamList = {
  tabs: NavigatorScreenParams<TabParamList> | undefined;
  providers: undefined;
  info: undefined;
  appearance: undefined;
  bundle: { id: string };
  applicationFeedback: { manifest: ApplicationManifest; ownerId: string };
  marketDetail: { item: MarketApplication; publish?: boolean };
  myApps: undefined;
  account: undefined;
  composePost:
    | {
        application?: MarketApplication;
        draft?: UserPostDraft;
        mode?: "post" | "create";
      }
    | undefined;
  postDetail: {
    post: UserPost;
    commentId?: string;
    initialDetail?: PostDetail;
  };
  notifications: undefined;
  authorProfile: { author: PublicAuthor };
};

export const shellNavigationRef = createNavigationContainerRef<RootParamList>();
function openAuthor(author: PublicAuthor) {
  if (shellNavigationRef.isReady())
    shellNavigationRef.navigate("authorProfile", { author });
}

async function openNotice(notice: Notice) {
  if (notice.kind === "work-success" || notice.kind === "work-failure") {
    if (!notice.appId) throw new Error("这条制作通知缺少作品信息");
    await openApplicationWorkshop(
      notice.appId,
      notice.postPreview,
      false,
      false
    );
    return true;
  }
  const origin = shellNavigationRef.getCurrentRoute()?.key;
  const detail = await fetchPostDetail(
    notice.postId,
    undefined,
    notice.commentId
  );
  if (
    !shellNavigationRef.isReady() ||
    shellNavigationRef.getCurrentRoute()?.key !== origin
  )
    return false;
  shellNavigationRef.navigate("postDetail", {
    post: detail.post,
    commentId: notice.commentId,
    initialDetail: detail,
  });
  return true;
}

function NotificationsTab({
  onOpen,
}: {
  onOpen: (notice: Notice) => Promise<boolean>;
}) {
  const { gesture } = useProfileDrawer();
  return <NotificationsScreen drawerGesture={gesture} onOpen={onOpen} />;
}

const Stack = createNativeStackNavigator<RootParamList>();
const Tabs = createMaterialTopTabNavigator<TabParamList>();
const mountedBundles = new Set<string>();
const mountWaiters = new Map<string, Set<() => void>>();
let openingRequest = 0;

function waitForBundleMount(id: string): Promise<void> {
  if (mountedBundles.has(id)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const waiters = mountWaiters.get(id) ?? new Set<() => void>();
    const finish = () => {
      clearTimeout(timer);
      waiters.delete(finish);
      if (!waiters.size) mountWaiters.delete(id);
      resolve();
    };
    const timer = setTimeout(() => {
      waiters.delete(finish);
      if (!waiters.size) mountWaiters.delete(id);
      reject(new Error("页面准备超时，请重试"));
    }, 5000);
    waiters.add(finish);
    mountWaiters.set(id, waiters);
  });
}

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export function openShellTab(id: ShellTabId) {
  if (!shellNavigationRef.isReady()) return;
  shellNavigationRef.navigate("tabs", { screen: id });
}
function openPublication(mode: "post" | "create" = "post") {
  void requireAccount().then((allowed) => {
    if (allowed && shellNavigationRef.isReady())
      shellNavigationRef.navigate("composePost", { mode });
  });
}
export async function openPublicMarketApplication(appId: string) {
  if (!shellNavigationRef.isReady()) return;
  const origin = shellNavigationRef.getCurrentRoute()?.key;
  if (await isApplicationInstalled(appId)) {
    if (shellNavigationRef.getCurrentRoute()?.key === origin)
      await openShellBundle(appId);
    return;
  }
  const item = await fetchPublicMarketApplication(appId);
  if (
    shellNavigationRef.isReady() &&
    shellNavigationRef.getCurrentRoute()?.key === origin
  )
    shellNavigationRef.navigate("marketDetail", { item });
}

export async function openShellBundle(id: string) {
  if (!shellNavigationRef.isReady()) return false;
  const request = ++openingRequest;
  const origin = shellNavigationRef.getCurrentRoute()?.key;
  const isCurrent = () =>
    request === openingRequest &&
    shellNavigationRef.isReady() &&
    shellNavigationRef.getCurrentRoute()?.key === origin;
  try {
    await openFeature(id);
    if (!isCurrent()) return false;
    if (!mountedBundles.has(id)) {
      const mounted = waitForBundleMount(id);
      shellNavigationRef.preload("bundle", { id });
      await mounted;
      // Let Fabric commit the preloaded view before starting the native transition.
      await nextFrame();
      await nextFrame();
    }
    if (!isCurrent()) return false;
    console.log("route push", "bundle", id);
    shellNavigationRef.navigate("bundle", { id });
    return true;
  } catch (error) {
    if (isCurrent())
      Toast.show({
        type: "error",
        text1: "应用未能打开",
        text2: error instanceof Error ? error.message : String(error),
      });
    return false;
  }
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

/** Native-stack preloads this route before its entrance transition. */
function BundlePage({
  id,
  render,
}: {
  id: string;
  render: (id: string, onBack: () => void) => ReactNode;
}) {
  const colors = palettes[useTheme().mode];
  function ready() {
    if (mountedBundles.has(id)) return;
    mountedBundles.add(id);
    for (const finish of [...(mountWaiters.get(id) ?? [])]) finish();
  }
  useEffect(
    () => () => {
      mountedBundles.delete(id);
    },
    [id]
  );
  const Page = id === bootstrap.defaultApplication ? View : Screen;
  return (
    <Page style={{ flex: 1, backgroundColor: colors.canvas }}>
      <View style={styles.feature} onLayout={ready}>
        {render(id, goBack)}
      </View>
    </Page>
  );
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
          backgroundColor: pixelTheme(colors).canvas,
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
          if (route) jumpTo(route.key);
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
  onMode: (mode: ThemeMode) => void;
  renderBundle: (id: string, onBack: () => void) => ReactNode;
};

export function ShellNavigator(props: ShellNavigatorProps) {
  const reduceMotion = useReducedMotion();
  const installedIds = useMemo(
    () => props.listed.map((item) => item.id),
    [props.listed]
  );
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
                      lazy: true,
                      sceneStyle: { backgroundColor: colors.canvas },
                    }}
                  >
                    <Tabs.Screen name="feed">
                      {() => (
                        <FeedScreen
                          onAuthor={openAuthor}
                          onApplication={openPublicMarketApplication}
                          onProfile={showProfileDrawer}
                          onPost={(post) =>
                            shellNavigationRef.navigate("postDetail", { post })
                          }
                          onCompose={() => {
                            void requireAccount().then((allowed) => {
                              if (allowed && shellNavigationRef.isReady())
                                shellNavigationRef.navigate("composePost");
                            });
                          }}
                        />
                      )}
                    </Tabs.Screen>
                    <Tabs.Screen name="market">
                      {() => (
                        <MarketScreen
                          onAuthor={openAuthor}
                          onDetail={(item) =>
                            shellNavigationRef.navigate("marketDetail", {
                              item,
                            })
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
                    </Tabs.Screen>
                    <Tabs.Screen name="notifications">
                      {() => <NotificationsTab onOpen={openNotice} />}
                    </Tabs.Screen>
                    <Tabs.Screen name="mine">
                      {() => (
                        <MyProfileScreen
                          onAccount={() =>
                            shellNavigationRef.navigate("account")
                          }
                          onPost={(post) =>
                            shellNavigationRef.navigate("postDetail", { post })
                          }
                          onApplication={openPublicMarketApplication}
                          onDetail={(item) =>
                            shellNavigationRef.navigate("marketDetail", {
                              item,
                            })
                          }
                          onOpen={props.onOpenBundle}
                          onCreate={() => openPublication("create")}
                        />
                      )}
                    </Tabs.Screen>
                  </Tabs.Navigator>
                </ScreenEdge>
              </ProfileDrawer>
            )}
          </Stack.Screen>
          <Stack.Screen name="marketDetail">
            {({ route }) => (
              <MarketDetailScreen
                publish={route.params.publish}
                item={route.params.item}
                onBack={goBack}
                onOpen={props.onOpenBundle}
                onModify={(manifest, ownerId) =>
                  shellNavigationRef.navigate("applicationFeedback", {
                    manifest,
                    ownerId,
                  })
                }
                onSharePost={(application) =>
                  shellNavigationRef.navigate("composePost", { application })
                }
                onAuthor={openAuthor}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="myApps">
            {() => (
              <MyApplicationsScreen
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
          <Stack.Screen name="applicationFeedback">
            {({ route }) => (
              <ApplicationFeedbackScreen
                key={`${route.params.ownerId}.${route.params.manifest.appId}.${route.params.manifest.releaseId}`}
                manifest={route.params.manifest}
                ownerId={route.params.ownerId}
                onBack={goBack}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="account"
            options={{ animation: "slide_from_right", animationDuration: 220 }}
          >
            {() => <AccountScreen onBack={goBack} />}
          </Stack.Screen>
          <Stack.Screen name="composePost">
            {({ route }) => (
              <PublicationScreen
                onBack={goBack}
                onCreate={async (prompt) => {
                  const target = await openCreationRequest(
                    bootstrap.defaultApplication,
                    prompt,
                    false
                  );
                  return (
                    !!target &&
                    (await openShellBundle(bootstrap.defaultApplication))
                  );
                }}
                initialMode={route.params?.mode}
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
            {() => <NotificationsScreen onBack={goBack} onOpen={openNotice} />}
          </Stack.Screen>
          <Stack.Screen name="authorProfile">
            {({ route }) => (
              <AuthorProfileScreen
                key={route.params.author.id}
                initialAuthor={route.params.author}
                onBack={goBack}
                onPost={(post) =>
                  shellNavigationRef.navigate("postDetail", { post })
                }
                onApplication={openPublicMarketApplication}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="providers">
            {() => <ProvidersScreen onBack={goBack} />}
          </Stack.Screen>

          <Stack.Screen name="appearance">
            {() => (
              <AppearanceScreen
                mode={props.mode}
                onMode={props.onMode}
                onBack={goBack}
              />
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
