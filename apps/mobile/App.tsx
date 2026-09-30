import { reportApplicationFailure } from "./src/runtime/applications";
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { bundles, openFeature, refreshApplications, restoreApplications } from "../../packages/features/src/registry";
import type { FeatureComponent } from "../../packages/features/src/featureHost";
import NativePluginHost from "./src/NativePluginHost";
import { loadCatalog, saveCatalog, type CatalogEntry } from "./src/shell/catalog";
import { openShellBundle, openShellTab, ShellNavigator } from "./src/shell/navigation";
import { BackButton } from "./src/shell/BackButton";
import { readPackageValue, subscribePackageValue } from "../../packages/ui/packageLink";
import { theme, palettes, themedStyleSheet, type ThemeMode } from "../../packages/ui/theme";
import { ThemeProvider } from "../../packages/ui/ThemeProvider";
import { shellAppearance } from "../../packages/platform/src/shellCapabilities";
import { applicationContext } from "../../packages/app-sdk/src/runtime";
import { readShellValue, removeShellValue, writeShellValue } from "./src/shell/shellStorage";
import { startFeedSummary } from "./src/shell/feed/summary";
import { readFeedPosts } from "../../packages/ui/feed/store";
import { UpdateBanner } from "./src/shell/UpdateBanner";
import { applyPackageUpdates, checkPackageUpdates, startReleaseWatch, updateSignature, type PendingPackage } from "./src/shell/packageUpdates";

type ShellItem = (typeof bundles)[number] & {
  hidden: boolean;
  pinned: boolean;
  trashedAt?: number;
  purged?: boolean;
  lastOpenedAt?: number;
};

type BoundaryProps = { children: ReactNode; resetKey: number; onError?: (message: string) => void };
type BoundaryState = { error?: string };

class FeatureBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = {};

  static getDerivedStateFromError(error: unknown): BoundaryState {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }

  componentDidCatch(error: unknown) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
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
      return <Text style={styles.error}>这个应用打不开：{this.state.error}</Text>;
    }
    return this.props.children;
  }
}

function App() {
  return (
    <SafeAreaProvider>
      <ShellApp />
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
  useEffect(() => {
    const utils = (globalThis as {
      ErrorUtils?: {
        getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      };
    }).ErrorUtils;
    if (!utils) return;
    const previous = utils.getGlobalHandler();
    utils.setGlobalHandler((error, isFatal) => {
      const message = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
      console.log("app error", isFatal ? "fatal" : "js", message.slice(0, 300));

      previous?.(error, isFatal);
    });
    return () => {
      utils.setGlobalHandler(previous);
    };
  }, []);

  useEffect(() => {
    if (!pluginsReady) return;
    console.log("shell ready");
    void (async () => {
      try {
        await NativePluginHost.call("shell", "bundleReady", "{}");
      } catch (error) {
        console.log("bundle ready failed", error instanceof Error ? error.message : error);
      }
      const started = Date.now();
      startReleaseWatch(() => {
        void refreshUpdates();
      });
      try {
        await syncPlugins();
        void refreshUpdates();
      } catch (error) {
        console.log("shell warm failed", error instanceof Error ? error.message : error);
      }
      console.log("shell warm ms", Date.now() - started);
    })();
    startFeedSummary();
  }, [pluginsReady]);

  useEffect(() => {
    if (!pluginsReady) return;
    let disposed = false;
    const timer = setTimeout(() => {
      void (async () => {
        // Warm cards after the first frame; main pages remain lazy.
        for (const bundle of bundles) {
          if (disposed) return;
          if (!catalog.some(item => item.id === bundle.id && !item.purged && !item.trashedAt)) continue;
          await Promise.resolve(bundle.load()).catch((error: unknown) => console.log("application warm failed", bundle.id, String(error)));
          if (!disposed) setCatalog(current => [...current]);
        }
      })();
      void refreshApplications().then(() => { if (!disposed) setCatalog(current => [...current]); });
    }, 100);
    return () => { disposed = true; clearTimeout(timer); };
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
        const appearance = await shellAppearance().catch(() => ({ mode: "dark" as const }));
        const nextMode = appearance.mode === "light" ? "light" : "dark";
        setMode(nextMode);
        let stored = await loadCatalog();
        await restoreApplications();
        if (!await readShellValue("application.bootstrap.v1")) {
          const bootstrap = require("../../tools/applications/bootstrap.json");
          const ids: string[] = stored.length || readFeedPosts().length ? bootstrap.legacyInstalled : bootstrap.defaultInstalled;
          for (const id of ids) if (!stored.some(entry => entry.id === id)) stored.push({ id, hidden: false, pinned: true });
          await saveCatalog(stored);
          writeShellValue("application.bootstrap.v1", "done");
        }
        console.log("catalog loaded", stored.length);
        setCatalog(stored);
        removeShellValue("shell.bundleSource.v1");
        console.log("bundle source online");
      } catch (error) {
        console.log("shell boot failed", error instanceof Error ? error.message : error);
      } finally {
        console.log("shell local ready ms", Date.now() - started);
        setPluginsReady(true);
      }
    })();
  }, []);

  const items = useMemo<ShellItem[]>(() => {
    return bundles.filter(bundle => catalog.some(entry => entry.id === bundle.id)).map((bundle) => {
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
    const next = upsert(catalog, id, patch);
    setCatalog(next);
    try {
      await saveCatalog(next);
    } catch (error) {
      console.log("bundle catalog save failed", error instanceof Error ? error.message : error);
    }
  }

  async function rememberOpen(id: string) {
    await patchCatalog(id, { lastOpenedAt: Date.now() });
  }

  function openBundle(id: string) {
    openShellBundle(id);
    setTimeout(() => {
      void rememberOpen(id);
    }, 600);
  }

  /** 在动态里对某位朋友说一句：去工坊，用 TA 的名字起个头，接着写想要的变化。 */
  function replyToFriend(id: string) {
    const title = bundles.find((item) => item.id === id)?.title ?? id;
    applicationContext(require("../../tools/applications/bootstrap.json").defaultApplication).navigation.create(`想让「${title}」`);
  }

  async function changeMode(next: ThemeMode) {
    setMode(next);
    try {
      await shellAppearance(next);
    } catch (error) {
      console.log("appearance failed", error instanceof Error ? error.message : error);
    }
  }

  async function refreshUpdates(force = false, strict = false): Promise<PendingPackage[]> {
    try {
      const items = await checkPackageUpdates();
      const signature = updateSignature(items);
      if (force) removeShellValue("shell.updates.dismissed");
      const dismissed = force ? undefined : await readShellValue("shell.updates.dismissed");
      const visible = signature && signature !== dismissed ? items : [];
      setUpdates(visible);
      return visible;
    } catch (error) {
      console.log("package updates failed", error instanceof Error ? error.message : error);
      if (strict) throw error;
      return [];
    }
  }

  async function applyUpdatesNow() {
    setUpdateBusy(true);
    try {
      removeShellValue("shell.updates.dismissed");
      await applyPackageUpdates();
    } catch (error) {
      console.log("package updates apply failed", error instanceof Error ? error.message : error);
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
      <View style={[styles.container, { backgroundColor: palettes[mode].canvas }]}>
        <StatusBar barStyle={mode === "light" ? "dark-content" : "light-content"} />
        {!pluginsReady ? (
          <View style={styles.boot}>
            <Text style={{ color: palettes[mode].ink2 }}>正在打开应用空间…</Text>
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
              <FeatureBoundary resetKey={featureKey} onError={(message) => { noteError(`feature:${id}`, message); void reportApplicationFailure(id); }}>
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
            onNow={() => {
              void applyUpdatesNow();
            }}
            onLater={deferUpdates}
          />
        ) : null}
      </View>
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
  const [opened, setOpened] = useState<{ component?: FeatureComponent; failed: string }>({ failed: "" });
  useEffect(() => {
    let disposed = false;
    setOpened({ failed: "" });
    void openFeature(id).then(component => {
      if (!disposed) setOpened({ component, failed: "" });
    }, error => {
      if (!disposed) setOpened({ failed: error instanceof Error ? error.message : String(error) });
    });
    return () => { disposed = true; };
  }, [id]);
  const { component, failed } = opened;
  useEffect(() => { if (failed) onError?.(failed); }, [failed]);

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
      <Text style={styles.error}>{failed || "正在加载应用…"}</Text>
    </View>
  );
}

function upsert(entries: CatalogEntry[], id: string, patch: Partial<CatalogEntry>): CatalogEntry[] {
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
    const raw = await NativePluginHost.call(
      "shell",
      "syncPlugins",
      "{}",
    );
    console.log("plugins synced", raw);
  } catch (error) {
    console.log("plugin sync failed", error instanceof Error ? error.message : error);
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
