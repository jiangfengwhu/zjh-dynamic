import type { ApkProgress } from "./src/shell/apkUpdates";
import { ActivityIndicator } from "react-native";
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
import { StatusBar, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { PixelFeedback } from "./src/shell/PixelFeedback";
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
import {
  readPackageValue,
  subscribePackageValue,
} from "../../packages/ui/packageLink";
import {
  theme,
  palettes,
  themedStyleSheet,
  type ThemeMode,
} from "../../packages/ui/theme";
import { ThemeProvider } from "../../packages/ui/ThemeProvider";
import { shellAppearance } from "../../packages/platform/src/shellCapabilities";
import {
  readShellValue,
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
            <Pressy onPress={this.props.onRetry} style={styles.retry}>
              <Text style={styles.retryText}>重新加载</Text>
            </Pressy>
            <Pressy onPress={this.props.onBack} style={styles.backAction}>
              <Text style={styles.stateHint}>返回</Text>
            </Pressy>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
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
          <BottomSheetModalProvider>
            <ShellApp />
          </BottomSheetModalProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

function ShellApp() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [pluginsReady, setPluginsReady] = useState(false);
  const [featureKey, setFeatureKey] = useState(0);
  const [mode, setMode] = useState<ThemeMode>(storedThemeMode);
  const [updates, setUpdates] = useState<PendingPackage[]>([]);
  const [updateBusy, setUpdateBusy] = useState(false);
  const updateWorking = useRef(false);
  const [updateError, setUpdateError] = useState("");
  const [apkProgress, setApkProgress] = useState<ApkProgress>();
  const appearanceWorking = useRef(false);
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
    if (!pluginsReady) return;
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
      idle = requestIdleCallback(() => {
        idle = undefined;
        void syncPlugins().finally(() => {
          if (!disposed) deferUpdates();
        });
      });
    }, 1500);
    return () => {
      disposed = true;
      clearTimeout(timer);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [pluginsReady]);

  useEffect(() => {
    return subscribePackageValue("theme.mode", (value) => {
      if (value !== "light" && value !== "dark") return;
      setMode((current) => (current === value ? current : value));
    });
  }, []);

  useEffect(() => {
    void (async () => {
      const started = Date.now();
      try {
        const appearance = await shellAppearance().catch(() => ({
          mode: "dark" as const,
        }));
        const nextMode = appearance.mode === "light" ? "light" : "dark";
        setMode(nextMode);
        let stored = await loadCatalog();
        await restoreApplications();
        if (!(await readShellValue("application.bootstrap.v1"))) {
          const bootstrap = require("../../tools/applications/bootstrap.json");
          const ids: string[] = bootstrap.defaultInstalled;
          for (const id of ids)
            if (!stored.some((entry) => entry.id === id))
              stored.push({ id, hidden: false, pinned: true });
          await saveCatalog(stored);
          writeShellValue("application.bootstrap.v1", "done");
        }
        console.log("catalog loaded", stored.length);
        setCatalog(stored);
        removeShellValue("shell.bundleSource.v1");
        console.log("bundle source online");
      } catch (error) {
        console.log(
          "shell boot failed",
          error instanceof Error ? error.message : error
        );
      } finally {
        console.log("shell local ready ms", Date.now() - started);
        setPluginsReady(true);
      }
    })();
  }, []);

  useEffect(() => subscribeCatalog(setCatalog), []);

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

  async function changeMode(next: ThemeMode) {
    if (appearanceWorking.current) return;
    appearanceWorking.current = true;
    const previous = mode;
    setMode(next);
    try {
      const result = await shellAppearance(next);
      if (!result.ok) throw new Error("配色保存失败");
    } catch (error) {
      setMode(previous);
      Toast.show({
        type: "error",
        text1: "配色未保存，已恢复",
        text2: error instanceof Error ? error.message : "请重试",
      });
    } finally {
      appearanceWorking.current = false;
    }
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
    <ThemeProvider mode={mode} onMode={(next) => void changeMode(next)}>
      <View
        style={[styles.container, { backgroundColor: palettes[mode].canvas }]}
      >
        <StatusBar
          barStyle={mode === "light" ? "dark-content" : "light-content"}
        />
        {!pluginsReady ? (
          <View style={styles.boot}>
            <Text
              accessibilityRole="header"
              style={[styles.stateTitle, { color: palettes[mode].ink1 }]}
            >
              紫金花
            </Text>
            <ActivityIndicator color={theme.accentText} />
            <Text style={{ color: palettes[mode].ink3, fontSize: 12 }}>
              正在打开应用空间…
            </Text>
          </View>
        ) : (
          <ShellNavigator
            mode={mode}
            listed={listed}
            onOpenBundle={openBundle}
            onReplyToFriend={replyToFriend}
            onCheckUpdates={async () => {
              const ready = await refreshUpdates(true, true);
              return ready.length > 0;
            }}
            onMode={(next) => void changeMode(next)}
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
        )}
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
      <PixelFeedback />
    </ThemeProvider>
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

function storedThemeMode(): ThemeMode {
  const value = readPackageValue("theme.mode");
  return value === "light" ? "light" : "dark";
}

async function syncPlugins() {
  try {
    const raw = await NativePluginHost.call("shell", "syncPlugins", "{}");
    console.log("plugins synced", raw);
  } catch (error) {
    console.log(
      "plugin sync failed",
      error instanceof Error ? error.message : error
    );
  }
}

const styles = themedStyleSheet(() => ({
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
    borderRadius: theme.radius.sm,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  retryText: { color: theme.onAccent, fontSize: 14, fontWeight: "700" },
  backAction: {
    backgroundColor: theme.inset,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 20,
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
