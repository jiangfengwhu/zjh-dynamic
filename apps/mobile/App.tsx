import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { bundles, openFeature } from "../../packages/features/src/registry";
import type { FeatureComponent } from "../../packages/features/src/featureHost";
import NativePluginHost from "./src/NativePluginHost";
import { loadCatalog, saveCatalog, type CatalogEntry } from "./src/shell/catalog";
import { openShellBundle, openShellTab, ShellNavigator } from "./src/shell/navigation";
import { BackButton } from "./src/shell/BackButton";
import type { AgentTrace } from "./src/shell/AgentScreen";
import { jollyPhaseFromStatus, noteJollyRun } from "../../packages/ui/jolly";
import { readPackageValue, subscribePackageValue } from "../../packages/ui/packageLink";
import { theme, palettes, themedStyleSheet, type ThemeMode } from "../../packages/ui/theme";
import { ThemeProvider } from "../../packages/ui/ThemeProvider";
import { JollyLoading } from "../../packages/ui/jolly";
import { shellAppearance } from "../../packages/platform/src/shellCapabilities";
import { runCloudEvolve, cancelCloudRun, loadJulesRun, loadJulesSession, saveJulesRun, clearJulesRun, clearJulesSession, inspectJulesSession, julesSessionLive, watchJulesSession, workshopStatus, confirmWorkshop } from "./src/shell/cloudEvolve";
import { readShellValue, removeShellValue, writeShellValue } from "./src/shell/shellStorage";
import { startFeedSummary } from "./src/shell/feed/summary";
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
  const [requirement, setRequirement] = useState("");
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [report, setReport] = useState("");
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [busy, setBusy] = useState(false);
  const [featureKey, setFeatureKey] = useState(0);
  const [providerId, setProviderId] = useState("jules");
  const [mode, setMode] = useState<ThemeMode>(storedThemeMode);
  const [updates, setUpdates] = useState<PendingPackage[]>([]);
  const [updateCompleted, setUpdateCompleted] = useState(false);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState(0);
  const [sessionId, setSessionId] = useState("");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [confirmationBusy, setConfirmationBusy] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const confirmingRef = useRef(false);
  const cloudStop = useRef(false);
  const cloudRun = useRef<{ runId?: string } | null>(null);
  const busyRef = useRef(false);
  const resumedCloud = useRef(false);

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
    void resumeCloud();
    startFeedSummary();
  }, [pluginsReady]);

  useEffect(() => {
    if (!pluginsReady) return;
    const phase = jollyPhaseFromStatus(busy, status);
    if (phase === "idle" && !prompt.trim()) return;
    const steps = [...new Set(traces.map((item) => item.title.trim()).filter(Boolean))].slice(-4);
    noteJollyRun({ phase, wish: prompt, status, steps });
  }, [pluginsReady, busy, status, prompt, traces]);

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
        const stored = await loadCatalog();
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
    return bundles.map((bundle) => {
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
    setRequirement((current) => (current.trim() ? current : `想让「${title}」`));
    openShellTab("agent");
  }

  async function changeMode(next: ThemeMode) {
    setMode(next);
    try {
      await shellAppearance(next);
    } catch (error) {
      console.log("appearance failed", error instanceof Error ? error.message : error);
    }
  }

  async function refreshUpdates(force = false): Promise<PendingPackage[]> {
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
    setUpdateCompleted(false);
    setUpdates([]);
    console.log("package updates deferred", signature);
  }

  async function stop() {
    cloudStop.current = true;
    const cloud = cloudRun.current;
    if (cloud) {
      setStatus("正在停止");
      console.log("evolve stop", cloud.runId ?? "pending");
      if (cloud.runId) {
        try {
          await cancelCloudRun(cloud.runId);
          setSessionId("");
        } catch (error) {
          console.log("evolve stop failed", error instanceof Error ? error.message : error);
        }
      }
      return;
    }
  }

  function newSession() {
    if (busyRef.current || sessionLoading || confirmingRef.current) return;
    if (sessionId) {
      resumedCloud.current = false;
      setSessionLoading(true);
      void resumeCloud();
      return;
    }
    clearJulesSession();
    setSessionId("");
    setPrompt("");
    setStatus("");
    setTraces([]);
    setReport("");
    setRunStartedAt(0);
    setAwaitingConfirmation(false);
    setAwaitingReply(false);
    setConfirmationMessage("");
  }

  async function confirmWish() {
    if (!sessionId || !awaitingConfirmation || busyRef.current || confirmingRef.current) return;
    confirmingRef.current = true;
    setConfirmationBusy(true);
    setConfirmationMessage("正在为这份心愿落款…");
    try {
      await confirmWorkshop(sessionId);
      clearJulesSession();
      setSessionId("");
      setAwaitingConfirmation(false);
      setAwaitingReply(false);
      setConfirmationMessage("");
      setStatus("这份心愿已收好，可以开始新的心愿了");
    } catch (error) {
      setConfirmationMessage(error instanceof Error ? error.message : "这份心愿暂时没能收好，请稍后再试");
      void refreshUpdates(true);
    } finally {
      confirmingRef.current = false;
      setConfirmationBusy(false);
    }
  }

  async function loadWish() {
    if (updateBusy || confirmingRef.current) return;
    try {
      const ready = await refreshUpdates(true);
      if (ready.length) await applyUpdatesNow();
      else setConfirmationMessage("已检查作品更新。确认收下时还会核对正在运行的版本。");
    } catch (error) {
      setConfirmationMessage(error instanceof Error ? error.message : "新作品暂时没接好，请稍后再试");
    }
  }

  function noteError(where: string, detail: string) {
    console.log("app error", where, detail.trim().slice(0, 4000));
  }

  async function runCloud(text: string, status = "正在生成") {
    busyRef.current = true;
    setBusy(true);
    const startedAt = Date.now();
    setRunStartedAt(startedAt);
    setPrompt(text);
    setAwaitingReply(false);
    setConfirmationMessage("");
    setTraces([]);
    setReport("");
    openShellTab("agent");
    setStatus(status);
    cloudStop.current = false;
    cloudRun.current = {};
    let waiting = false;
    try {
      const outcome = await runCloudEvolve({
        requirement: text,
        onStatus: setStatus,
        onTrace: setTraces,
        onRunId: (runId) => {
          setSessionId(runId);
          cloudRun.current = { runId };
          saveJulesRun({ session: runId, prompt: text, startedAt });
        },
        shouldStop: () => cloudStop.current,
      });
      if (outcome === "cancelled") {
        setSessionId("");
        setStatus("已停止");
        setBusy(false);
        return;
      }
      if (outcome === "waiting") {
        waiting = true;
        setAwaitingReply(true);
        return;
      }
      waiting = true;
      setAwaitingConfirmation(true);
      await workshopStatus(cloudRun.current?.runId || await loadJulesSession());
      await syncPlugins();
      setRequirement("");
      setFeatureKey((value) => value + 1);
      setStatus("正在检查新包");
      const ready = await refreshUpdates();
      setUpdateCompleted(ready.length > 0);
      setStatus(ready.length ? "有新包可以加载" : "已是最新");
      setBusy(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("evolve failed", message);
      setStatus(message);
      setBusy(false);
    } finally {
      cloudRun.current = null;
      busyRef.current = false;
      setBusy(false);
      if (!waiting) clearJulesRun();
    }
  }

  async function resumeCloud() {
    if (resumedCloud.current || busyRef.current) return;
    resumedCloud.current = true;
    const run = await loadJulesRun();
    const session = run?.session || await loadJulesSession();
    setSessionId(session);
    if (!session) {
      setSessionLoading(false);
      return;
    }
    let info: { state: string; url: string; title: string; startedAt: number } | undefined;
    try {
      info = await inspectJulesSession(session);
      if (info) {
        const workshop = await workshopStatus(session);
        if (workshop.merged) {
          clearJulesSession();
          setSessionId("");
          return;
        }
        setAwaitingConfirmation(workshop.completed);
        setAwaitingReply(workshop.state === "AWAITING_USER_FEEDBACK");
      }
    } catch (error) {
      console.log("jules resume failed", error instanceof Error ? error.message : error);
      return;
    } finally {
      setSessionLoading(false);
    }
    if (!info || info.state === "FAILED") {
      clearJulesSession();
      setSessionId("");
      busyRef.current = false;
      setBusy(false);
      setStatus(info?.state === "FAILED" ? "Jules 失败" : "上次的生成已经中断");
      console.log("jules resume dropped", session, info?.state ?? "missing");
      return;
    }
    if (julesSessionLive(info.state)) {
      const promptText = run?.prompt || info.title || "线上定制";
      const startedAt = run?.startedAt || info.startedAt;
      setPrompt(promptText);
      setRunStartedAt(startedAt);
      showAgent();
      saveJulesRun({ session, prompt: promptText, startedAt });
      console.log("jules resume", session, info.state);
      busyRef.current = true;
      setBusy(true);
      setStatus("正在接上");
      setTraces([{ id: "jules", kind: "status", title: "正在接上", state: "running", detail: info.url }]);
      cloudStop.current = false;
      cloudRun.current = { runId: session };
      let waiting = false;
      try {
        const outcome = await watchJulesSession(session, info.url, {
          onStatus: setStatus,
          onTrace: setTraces,
          shouldStop: () => cloudStop.current,
        }, startedAt);
        if (outcome === "cancelled") {
          setSessionId("");
          setStatus("已停止");
          setBusy(false);
          return;
        }
        if (outcome === "waiting") {
          waiting = true;
          setAwaitingReply(true);
          return;
        }
        waiting = true;
        setAwaitingConfirmation(true);
        await workshopStatus(session);
        await syncPlugins();
        setFeatureKey((value) => value + 1);
        setStatus("正在检查新包");
        const ready = await refreshUpdates();
        setUpdateCompleted(ready.length > 0);
        setStatus(ready.length ? "有新包可以加载" : "已是最新");
        setBusy(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.log("jules resume failed", message);
        setStatus(message);
        setBusy(false);
      } finally {
        cloudRun.current = null;
        busyRef.current = false;
        setBusy(false);
        if (!waiting) clearJulesRun();
      }
      return;
    }
    if (info.state === "COMPLETED") {
      setPrompt(run?.prompt || info.title || "这次的心愿");
      setRunStartedAt(run?.startedAt || info.startedAt);
      showAgent();
      busyRef.current = false;
      setBusy(false);
      setStatus("正在检查新包");
      console.log("jules resume completed", session);
      try {
        await syncPlugins();
        const ready = await refreshUpdates();
        setUpdateCompleted(ready.length > 0);
        setStatus(ready.length ? "有新包可以加载" : "已是最新");
      } catch (error) {
        console.log("jules resume check failed", error instanceof Error ? error.message : error);
      }
      // 保留这次心愿，重载新包后仍要由用户确认收下。
      return;
    }
    if (info.state === "PAUSED") {
      setAwaitingReply(true);
      setPrompt(run?.prompt || info.title || "线上定制");
      showAgent();
      busyRef.current = false;
      setBusy(false);
      setStatus("Jules 已暂停");
      console.log("jules resume paused", session);
    }
  }

  function showAgent() {
    openShellTab("agent");
    setTimeout(() => openShellTab("agent"), 400);
  }

  async function submit() {
    const text = requirement.trim();
    if (!text || busyRef.current || sessionLoading || confirmingRef.current || (sessionId && !awaitingReply)) return;
    console.log("evolve submit", providerId, text);
    await runCloud(text);
  }

  return (
      <ThemeProvider mode={mode} onMode={(next) => void changeMode(next)}>
      <View style={[styles.container, { backgroundColor: palettes[mode].canvas }]}>
        <StatusBar barStyle={mode === "light" ? "dark-content" : "light-content"} />
        {!pluginsReady ? (
          <View style={styles.boot}>
            <JollyLoading size="lg" label="Jolly 正在唤醒灵感空间..." />
          </View>
        ) : (
          <ShellNavigator
            mode={mode}
            listed={listed}
            requirement={requirement}
            prompt={prompt}
            status={status}
            busy={busy}
            traces={traces}
            report={report}
            startedAt={runStartedAt}
            sessionId={sessionId}
            sessionLoading={sessionLoading}
            onNewSession={newSession}
            awaitingConfirmation={awaitingConfirmation}
            awaitingReply={awaitingReply}
            confirmationBusy={confirmationBusy}
            confirmationMessage={confirmationMessage}
            onConfirmWish={() => void confirmWish()}
            onLoadWish={() => void loadWish()}
            providerId={providerId}
            onProviderChange={setProviderId}
            onRequirement={setRequirement}
            onSubmit={() => {
              void submit();
            }}
            onStop={() => {
              void stop();
            }}
            onOpenBundle={openBundle}
            onReplyToFriend={replyToFriend}
            onCheckUpdates={async () => {
              const ready = await refreshUpdates(true);
              return ready.length > 0;
            }}
            onMode={(next) => void changeMode(next)}
            renderBundle={(id, onBack) => (
              <FeatureBoundary resetKey={featureKey} onError={(message) => noteError(`feature:${id}`, message)}>
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
            completed={updateCompleted}
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
  // 页面代码已经在 app 包里，第一次打开时才执行它；已经登记过的页面直接拿来用，没有等待。
  const opened = useMemo<{ component?: FeatureComponent; failed: string }>(() => {
    try {
      return { component: openFeature(id), failed: "" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("feature load failed", id, message);
      return { failed: message };
    }
  }, [id]);
  const { component, failed } = opened;

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
      <Text style={styles.error}>{failed}</Text>
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
