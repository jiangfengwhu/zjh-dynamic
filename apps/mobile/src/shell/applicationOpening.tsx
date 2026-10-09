import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, View } from "react-native";
import { useTheme } from "../../../../packages/ui/theme";
import { Pressy } from "../../../../packages/ui/chrome";
import { HostText as Text } from "./feed/HostText";
type Request = { load: (signal: AbortSignal) => Promise<void>; resolve: () => void };
let show: (request: Request) => void = () => { throw new Error("加载入口尚未就绪"); };
export function showApplicationOpening(load: Request["load"]) { return new Promise<void>(resolve => show({ load, resolve })); }
export function ApplicationOpeningOverlay() {
  const { colors } = useTheme();
  const [request, setRequest] = useState<Request>();
  const active = useRef<Request>();
  const controller = useRef<AbortController>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  function close() { controller.current?.abort(); active.current?.resolve(); active.current = undefined; setRequest(undefined); }
  useEffect(() => { show = next => { controller.current?.abort(); active.current?.resolve(); active.current = next; setError(""); setRequest(next); }; return () => { controller.current?.abort(); active.current?.resolve(); show = () => { throw new Error("加载入口尚未就绪"); }; }; }, []);
  useEffect(() => {
    if (!request) return;
    const work = new AbortController(); controller.current = work; setError("");
    const frame = requestAnimationFrame(() => { void request.load(work.signal).then(() => { if (!work.signal.aborted && active.current === request) close(); }, cause => { if (!work.signal.aborted && active.current === request) setError(cause instanceof Error ? cause.message : "应用加载失败"); }); });
    return () => { cancelAnimationFrame(frame); work.abort(); };
  }, [request, attempt]);
  return <Modal visible={!!request} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
    <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.28)", alignItems: "center", justifyContent: "center", padding: 32 }}>
      <View style={{ width: "100%", maxWidth: 300, borderRadius: colors.radius.xxl, padding: 24, gap: 16, alignItems: "center", backgroundColor: colors.surface }}>
        {!error ? <ActivityIndicator color={colors.accent} size="large" /> : null}
        <Text style={{ color: colors.ink1, fontSize: 16, fontWeight: "600" }}>{error ? "应用暂时无法打开" : "正在打开应用"}</Text>
        {error ? <><Text style={{ color: colors.ink3, textAlign: "center" }}>{error}</Text><Pressy onPress={() => setAttempt(value => value + 1)} style={{ paddingHorizontal: 24, backgroundColor: colors.accent }}><Text style={{ color: colors.onAccent }}>重试</Text></Pressy></> : null}
        <Pressy onPress={close}><Text style={{ color: colors.ink3 }}>取消</Text></Pressy>
      </View>
    </View>
  </Modal>;
}
