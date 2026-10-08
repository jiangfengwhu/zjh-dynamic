import { notify as Toast } from "../../packages/ui/feedback/Toasts";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ApplicationQueries } from "../../packages/app-sdk/src/query-runtime";
import { Text } from "../../packages/ui/primitives/Typography";
import { useTheme } from "../../packages/ui/theme";
import type { ApkProgress } from "./src/shell/apkUpdates";
import { ActivityIndicator } from "react-native";
import { markStartup } from "./src/runtime/startupTiming";
import { openCreationComposer } from "./src/shell/creationComposer";
import { reportApplicationFailure } from "./src/runtime/applications";
import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { KeyboardViewport } from "../../packages/ui/keyboard";
import { Feedback } from "./src/shell/Feedback";
import {
  bundles,
  openFeature,
  cachedFeature,
  restoreApplications,
} from "../../packages/features/src/registry";
import type { FeatureComponent } from "../../packages/features/src/featureHost";
import NativePluginHost from "./src/NativePluginHost";
import {
  loadCatalog,
  saveCatalog,
  subscribeCatalog,
  type CatalogEntry,
} from "./src/shell/catalog";
import { openShellBundle, ShellNavigator } from "./src/shell/navigation";
import { Icon, Pressy } from "../../packages/ui/chrome";
import { BackButton } from "./src/shell/BackButton";
import { createThemedStyles, type ThemePreference } from "../../packages/ui/theme";
import { ThemeProvider } from "../../packages/ui/ThemeProvider";

import {
  readShellValue,
  readShellValueSync,
  removeShellValue,
  writeShellValue,
} from "./src/shell/shellStorage";
import { UpdateBanner } from "./src/shell/UpdateBanner";
import {
  applyPackageUpdates,
  checkPackageUpdates,
  updateSignature,
  type PendingPackage,
} from "./src/shell/packageUpdates";

type ShellItem = (typeof bundles)[number] & {
  hidden: boolean;
  pinned: boolean;
  trashedAt?: number;
  purged?: boolean;
  lastOpenedAt?: number;
};

type BoundaryProps = {
  children: ReactNode;
  resetKey: number;
  onError?: (message: string) => void;
  onRetry: () => void;
  onBack: () => void;
};
type BoundaryState = { error?: string };

class FeatureBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {};

  static getDerivedStateFromError(error: unknown): BoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }

  componentDidCatch(error: unknown) {
    const message =
      error instanceof Error
        ? `${error.message}\n${error.stack ?? ""}`
        : String(error);
    console.log("feature render failed", message.slice(0, 300));
    this.props.onError?.(message);
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: undefined });
    }
  }

  render() {
    if (this.state.error) {
      return <FeatureFailure {...this.props} />;
    }
    return this.props.children;
  }
}

function FeatureFailure(props: BoundaryProps) {
  const styles = useStyles();
  const { colors: theme } = useTheme();

  return (
        <View style={styles.boot}>
          <Icon name="alert" size={28} color={theme.accentText} />
          <Text accessibilityRole="header" style={styles.stateTitle}>
            应用暂时无法显示
          </Text>
          <Text style={styles.stateHint}>
            可以重新加载页面，或返回继续浏览。
          </Text>
          <View style={styles.recoveryActions}>
            <Pressy onPress={props.onRetry} style={styles.retry}>
              <Text style={styles.retryText}>重新加载</Text>
            </Pressy>
            <Pressy onPress={props.onBack} style={styles.backAction}>
              <Text style={styles.stateHint}>返回</Text>
            </Pressy>
          </View>
        </View>
  );
}

type Appearance = { mode: ThemePreference };
function storedAppearance(): Appearance {
  try {
    const value = JSON.parse(readShellValueSync("appearance.v2") ?? "null");
    if (value && ["system", "light", "dark"].includes(value.mode)) return { mode: value.mode };
  } catch {}
  return { mode: "system" };
}
function HostAppearance({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(storedAppearance);
  useEffect(() => {
    const idle = requestIdleCallback(() => {
      try { writeShellValue("appearance.v2", JSON.stringify(appearance)); }
      catch { Toast.show({ type: "error", text1: "外观设置未保存", text2: "当前外观仍可使用，请稍后重试" }); }
    }, { timeout: 1000 });
    return () => cancelIdleCallback(idle);
  }, [appearance]);
  return <ThemeProvider mode={appearance.mode}
    onMode={mode => setAppearance(current => ({ ...current, mode }))}>{children}</ThemeProvider>;
}

function App() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider
          statusBarTranslucent
          navigationBarTranslucent
          preserveEdgeToEdge
        >
            <HostAppearance><BottomSheetModalProvider><ApplicationQueries appId="__host"><KeyboardViewport reserveBottom={false}><ShellApp /></KeyboardViewport></ApplicationQueries></BottomSheetModalProvider></HostAppearance>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function ShellApp() {
  const styles = useStyles();
  const { colors: theme } = useTheme();

  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [shellLaidOut, setShellLaidOut] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);
  const catalogRevision = useRef(0);
  const [featureKey, setFeatureKey] = useState(0);
  const { mode, setMode } = useTheme();
  const [updates, setUpdates] = useState<PendingPackage[]>([]);
  const [updateBusy, setUpdateBusy] = useState(false);
  const updateWorking = useRef(false);
  const [updateError, setUpdateError] = useState("");
  const [apkProgress, setApkProgress] = useState<ApkProgress>();
  const shellReady = shellLaidOut && navigationReady;
  useEffect(() => { markStartup("shell-mounted"); }, []);

  useEffect(() => {
    const utils = (
      globalThis as {
        ErrorUtils?: {
          getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
          setGlobalHandler: (
            handler: (error: unknown, isFatal?: boolean) => void
          ) => void;
        };
      }
    ).ErrorUtils;
    if (!utils) return;
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error, isFatal) => {
      const message =
        error instanceof Error
          ? `${error.message}\n${error.stack ?? ""}`
          : String(error);
      console.log("app error", isFatal ? "fatal" : "js", message.slice(0, 300));

      previous?.(error, isFatal);
    });
    return () => {
      utils.setGlobalHandler(previous);
    };
  }, []);

  useEffect(() => {
    if (!shellReady) return;
    markStartup("shell-ready");
    // Acknowledge the healthy shell immediately; all maintenance follows the first interaction window.
    void NativePluginHost.call("shell", "bundleReady", "{}").catch(() => {});
    let disposed = false;
    let idle: ReturnType<typeof requestIdleCallback> | undefined;
    const deferUpdates = () => {
      if (idle !== undefined) cancelIdleCallback(idle);
      idle = requestIdleCallback(() => {
        idle = undefined;
        if (!disposed) void refreshUpdates();
      });
    };
    const timer = setTimeout(() => {
      if (!disposed) deferUpdates();
    }, 1500);
    return () => {
      disposed = true;
      clearTimeout(timer);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [shellReady]);


  useEffect(() => {
    if (!shellReady) return;
    let disposed = false;
    const idle = requestIdleCallback(() => {
      markStartup("installed-restore-start");
      void (async () => {
        try {
          await restoreApplications();
          const before = catalogRevision.current;
          const stored = await loadCatalog();
          if (disposed) return;
          // A concurrent install/uninstall wins over this older snapshot. Refresh
          // the current array so restored metadata also becomes visible.
          if (before === catalogRevision.current) setCatalog(stored);
          else setCatalog(current => [...current]);
          console.log("catalog loaded", stored.length);
          removeShellValue("shell.bundleSource.v1");
          markStartup("installed-restored");
        } catch (error) {
          if (!disposed) console.log("catalog restore failed", error instanceof Error ? error.message : error);
        }
      })();
    });
    return () => { disposed = true; cancelIdleCallback(idle); };
  }, [shellReady]);

  useEffect(() => subscribeCatalog(entries => {
    catalogRevision.current++;
    setCatalog(entries);
  }), []);

  const items = useMemo<ShellItem[]>(() => {
    return bundles
      .filter((bundle) => catalog.some((entry) => entry.id === bundle.id))
      .map((bundle) => {
        const entry = catalog.find((item) => item.id === bundle.id);
        const pinned = entry?.pinned ?? !(entry?.hidden ?? false);
        const trashedAt = entry?.trashedAt;
        const purged = entry?.purged ?? false;
        return {
          ...bundle,
          title: entry?.titleOverride?.trim() || bundle.title,
          pinned: pinned && !trashedAt && !purged,
          hidden: !pinned || Boolean(trashedAt) || purged,
          trashedAt,
          purged,
          lastOpenedAt: entry?.lastOpenedAt,
        };
      });
  }, [catalog]);

  const listed = items.filter((item) => !item.trashedAt && !item.purged);

  async function patchCatalog(id: string, patch: Partial<CatalogEntry>) {
    const next = upsert(await loadCatalog(), id, patch);
    setCatalog(next);
    try {
      await saveCatalog(next);
    } catch (error) {
      console.log(
        "bundle catalog save failed",
        error instanceof Error ? error.message : error
      );
    }
  }

  async function rememberOpen(id: string) {
    await patchCatalog(id, { lastOpenedAt: Date.now() });
  }

  async function openBundle(id: string) {
    const opened = await openShellBundle(id);
    if (opened) void rememberOpen(id);
    return opened;
  }

  /** 在动态里对某位朋友说一句：去工坊，用 TA 的名字起个头，接着写想要的变化。 */
  function replyToFriend(id: string) {
    const title = bundles.find((item) => item.id === id)?.title ?? id;
    openCreationComposer({ appId: id, title });
  }


  async function refreshUpdates(
    force = false,
    strict = false
  ): Promise<PendingPackage[]> {
    try {
      const items = await checkPackageUpdates();
      const signature = updateSignature(items);
      if (force) removeShellValue("shell.updates.dismissed");
      const dismissed = force
        ? undefined
        : await readShellValue("shell.updates.dismissed");
      const visible = signature && signature !== dismissed ? items : [];
      setUpdates(visible);
      return visible;
    } catch (error) {
      console.log(
        "package updates failed",
        error instanceof Error ? error.message : error
      );
      if (strict) throw error;
      return [];
    }
  }

  async function applyUpdatesNow() {
    if (updateWorking.current) return;
    updateWorking.current = true;
    setUpdateError("");
    setUpdateBusy(true);
    try {
      removeShellValue("shell.updates.dismissed");
      await applyPackageUpdates(updates, setApkProgress);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "更新未完成，请重试";
      setUpdateError(message);
      Toast.show({ type: "error", text1: "更新未完成", text2: message });
    } finally {
      updateWorking.current = false;
      setUpdateBusy(false);
    }
  }

  function deferUpdates() {
    const signature = updateSignature(updates);
    if (signature) writeShellValue("shell.updates.dismissed", signature);
    setUpdates([]);
    console.log("package updates deferred", signature);
  }

  function noteError(where: string, detail: string) {
    console.log("app error", where, detail.trim().slice(0, 4000));
  }

  return (
    <>
      <View
        style={[styles.container, { backgroundColor: theme.canvas }]}
        onLayout={() => { markStartup("shell-layout"); setShellLaidOut(true); }}
      >
        <StatusBar
          barStyle={mode === "light" ? "dark-content" : "light-content"}
        />
        <ShellNavigator
          onReady={() => { markStartup("navigator-ready"); setNavigationReady(true); }}
          mode={mode}
          listed={listed}
          onOpenBundle={openBundle}
          onReplyToFriend={replyToFriend}
          onCheckUpdates={async () => {
            const ready = await refreshUpdates(true, true);
            return ready.length > 0;
          }}
          onMode={setMode}
          renderBundle={(id, onBack) => (
            <FeatureBoundary
              resetKey={featureKey}
              onRetry={() => setFeatureKey((value) => value + 1)}
              onBack={onBack}
              onError={(message) => {
                noteError(`feature:${id}`, message);
                void reportApplicationFailure(id);
              }}
            >
              <FeatureHost
                id={id}
                onBack={onBack}
                onError={(message) => noteError(`feature:${id}`, message)}
              />
            </FeatureBoundary>
          )}
        />
        {updates.length > 0 ? (
          <UpdateBanner
            items={updates}
            busy={updateBusy}
            completed={false}
            error={updateError}
            apkProgress={apkProgress}
            onNow={() => {
              void applyUpdatesNow();
            }}
            onLater={deferUpdates}
          />
        ) : null}
      </View>
      <Feedback />
    </>
  );
}

function FeatureHost({
  id,
  onBack,
  onError,
}: {
  id: string;
  onBack?: () => void;
  onError?: (message: string) => void;
}) {
  const styles = useStyles();
  const { colors: theme } = useTheme();

  const [opened, setOpened] = useState<{
    id: string;
    component?: FeatureComponent;
    failed: string;
  }>(() => ({ id, component: cachedFeature(id), failed: "" }));
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    const cached = cachedFeature(id);
    setLoadingVisible(false);
    if (cached) {
      setOpened({ id, component: cached, failed: "" });
      return;
    }
    setOpened({ id, failed: "" });
    const timer = setTimeout(() => {
      if (!disposed) setLoadingVisible(true);
    }, 300);
    void openFeature(id).then(
      (component) => {
        clearTimeout(timer);
        if (!disposed) setOpened({ id, component, failed: "" });
      },
      (error) => {
        clearTimeout(timer);
        if (!disposed)
          setOpened({
            id,
            failed: error instanceof Error ? error.message : String(error),
          });
      }
    );
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [id, attempt]);
  const component =
    cachedFeature(id) ?? (opened.id === id ? opened.component : undefined);
  const failed = opened.id === id ? opened.failed : "";
  useEffect(() => {
    if (failed) onError?.(failed);
  }, [failed]);

  if (component) {
    const FeatureApp = component;
    return <FeatureApp />;
  }
  return (
    <View style={styles.boot}>
      {onBack ? (
        <View style={styles.featureBackBtn}>
          <BackButton onPress={onBack} />
        </View>
      ) : null}
      {failed ? (
        <>
          <Icon name="alert" size={28} color={theme.accentText} />
          <Text accessibilityRole="header" style={styles.stateTitle}>
            应用未能打开
          </Text>
          <Text style={styles.stateHint}>请检查网络，再试一次。</Text>
          <Pressy
            onPress={() => setAttempt((value) => value + 1)}
            style={styles.retry}
          >
            <Text style={styles.retryText}>重新加载</Text>
          </Pressy>
        </>
      ) : opened.id === id && loadingVisible ? (
        <>
          <ActivityIndicator color={theme.accentText} />
          <Text style={styles.stateHint}>正在加载应用…</Text>
        </>
      ) : null}
    </View>
  );
}

function upsert(
  entries: CatalogEntry[],
  id: string,
  patch: Partial<CatalogEntry>
): CatalogEntry[] {
  const existing = entries.find((item) => item.id === id);
  const nextEntry: CatalogEntry = {
    id,
    hidden: existing?.hidden ?? false,
    pinned: existing?.pinned,
    trashedAt: existing?.trashedAt,
    purged: existing?.purged,
    titleOverride: existing?.titleOverride,
    lastOpenedAt: existing?.lastOpenedAt,
    ...patch,
  };
  return [...entries.filter((item) => item.id !== id), nextEntry];
}



const useStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.canvas,
  },
  boot: {
    flex: 1,
    backgroundColor: theme.canvas,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  stateTitle: {
    color: theme.ink1,
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "700",
  },
  stateHint: {
    color: theme.ink3,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  recoveryActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  retry: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius.pill,
    minHeight: 48,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  retryText: { color: theme.onAccent, fontSize: 15, fontWeight: "700" },
  backAction: {
    backgroundColor: theme.surfaceRaised,
    borderRadius: theme.radius.pill,
    minHeight: 48,
    paddingHorizontal: 24,
  },
  error: {
    color: theme.danger,
    fontSize: 16,
    padding: 24,
  },
  featureBackBtn: {
    position: "absolute",
    top: 14,
    left: 14,
    zIndex: 20,
  },
}));

export default App;
