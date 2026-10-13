import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StatusBar, Text, View, useColorScheme } from "react-native";

type Props = { children: ReactNode; scope: "shell" | "drawer"; onClose?: () => void };

/** Recovery must render even if navigation, theme, icons or shared UI fail. */
export class HostErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.warn("host render failed", this.props.scope, error.name, info.componentStack); }
  render() {
    return this.state.failed
      ? <HostRecovery scope={this.props.scope} onClose={this.props.onClose} onRetry={() => this.setState({ failed: false })} />
      : this.props.children;
  }
}

function HostRecovery({ scope, onRetry, onClose }: Omit<Props, "children"> & { onRetry: () => void }) {
  const dark = useColorScheme() === "dark", active = useRef(true), working = useRef(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const ink = dark ? "#F4F0FA" : "#21162D", muted = dark ? "#B6ACC4" : "#766B82";
  useEffect(() => {
    active.current = true;
    // A usable recovery screen can acknowledge startup and dismiss the native splash.
    if (scope === "shell") {
      try { void require("../NativePluginHost").default.call("shell", "bundleReady", "{}").catch(() => {}); } catch {}
    }
    return () => { active.current = false; };
  }, [scope]);
  const repair = async () => {
    if (working.current) return;
    working.current = true; setBusy(true); setMessage("正在检查并下载更新…");
    try {
      const { checkPackageUpdates, applyPackageUpdates } = require("./packageUpdates") as typeof import("./packageUpdates");
      const items = await checkPackageUpdates();
      if (!active.current) return;
      if (!items.length) { setMessage("暂无新更新，可以重试界面，或稍后再检查。"); return; }
      setMessage(items.some(item => item.kind === "apk") ? "正在下载新版生花…" : "正在加载修复…");
      await applyPackageUpdates(items, progress => {
        if (active.current && progress.phase === "downloading") setMessage(`正在下载新版生花…${Math.floor(progress.received / progress.total * 100)}%`);
      });
      if (active.current) setMessage(items.some(item => item.kind === "apk") ? "请完成系统安装后重新打开生花。" : "更新已准备好，请重新打开生花。");
    } catch {
      if (active.current) setMessage("更新未完成，请检查网络后重试。");
    } finally {
      working.current = false; if (active.current) setBusy(false);
    }
  };
  return <View style={{ flex: 1, backgroundColor: dark ? "#160F20" : "#F8F4FC", justifyContent: "center", paddingHorizontal: 24, paddingTop: (StatusBar.currentHeight ?? 24) + 24, paddingBottom: 48 }}>
    <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
    <View style={{ width: "100%", maxWidth: 380, alignSelf: "center", gap: 14 }}>
      <Text accessibilityRole="header" style={{ color: ink, fontSize: 20, lineHeight: 28, fontWeight: "700" }}>{scope === "drawer" ? "菜单暂时无法显示" : "界面暂时无法显示"}</Text>
      <Text style={{ color: muted, fontSize: 14, lineHeight: 22 }}>可以重试界面，或检查并加载更新。本机数据不会被清除。</Text>
      {message ? <Text accessibilityLiveRegion="polite" style={{ color: muted, fontSize: 13, lineHeight: 20 }}>{message}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="检查并加载更新" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={() => void repair()} style={{ minHeight: 44, borderRadius: 22, padding: 12, backgroundColor: "#7851D8", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", opacity: busy ? .7 : 1 }}>
        {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}<Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>{busy ? "正在处理…" : "检查并加载更新"}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} onPress={onRetry} style={{ minHeight: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", backgroundColor: dark ? "#292034" : "#EDE5F4", opacity: busy ? .5 : 1 }}><Text style={{ color: ink, fontSize: 14 }}>重试界面</Text></Pressable>
      {onClose ? <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}><Text style={{ color: muted, fontSize: 14 }}>关闭菜单</Text></Pressable> : null}
    </View>
  </View>;
}
