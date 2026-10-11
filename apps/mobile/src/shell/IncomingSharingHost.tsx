import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, BackHandler, DeviceEventEmitter, View } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, useBottomSheetScrollableCreator } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { shell } from "../../../../packages/platform/src/phone";
import { useTheme } from "../../../../packages/ui/theme";
import { Pressy } from "../../../../packages/ui/chrome";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import type { IncomingShare } from "../../../../packages/app-sdk/src";
import { HostText as Text } from "./feed/HostText";
import { installedMarket, type MarketApplication } from "./market";
import { ApplicationIcon } from "./ApplicationIcon";
import { AnimatedFlashList } from "./AnimatedFlashList";
import { PageSkeleton } from "./LoadingSkeleton";
import { openShellBundle } from "./navigation";
import { shellNavigationRef } from "./navigationRef";
import { useAccount } from "./account";
import { useEventCallback } from "./useEventCallback";

type PendingShare = IncomingShare & { preparing?: boolean; error?: string };
const points = ["60%"];
const key = (item: MarketApplication) => item.manifest.appId;
export function IncomingSharingHost() {
  const { colors } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const { user } = useAccount();
  const sheet = useRef<BottomSheetModal>(null);
  const current = useRef<PendingShare | undefined>(undefined);
  const accepted = useRef(false);
  const busyRef = useRef(false);
  const closing = useRef(false);
  const refreshRef = useRef<() => void>(() => {});
  const [request, setRequest] = useState<PendingShare>();
  const [applications, setApplications] = useState<MarketApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const Scrollable = useBottomSheetScrollableCreator();
  useEffect(() => {
    let live = true, querying = false, again = false;
    const refresh = async () => {
      if (querying) { again = true; return; }
      querying = true;
      try {
        do {
          again = false;
          const value = await shell<{ ok: boolean; items?: PendingShare[] }>("incomingSharePending");
          if (!live || !value.ok || busyRef.current || closing.current) return;
          const next = value.items?.find(item => item.id === current.current?.id) ?? value.items?.[0];
          if (next) { current.current = next; accepted.current = false; setRequest(next); }
          else if (current.current) { accepted.current = true; closing.current = true; sheet.current?.dismiss(); }
        } while (again && live);
      } catch { /* Retry the queue on the next native event or resume. */ }
      finally { querying = false; }
    };
    refreshRef.current = () => { void refresh(); };
    const events = DeviceEventEmitter.addListener("zijinhua.incoming.share", () => { void refresh(); });
    const resumed = AppState.addEventListener("change", state => { if (state === "active") void refresh(); });
    void refresh();
    return () => { live = false; refreshRef.current = () => {}; events.remove(); resumed.remove(); };
  }, []);
  useLayoutEffect(() => { if (request) sheet.current?.present(); }, [request?.id]);
  useEffect(() => {
    if (!request) return;
    let live = true;
    setLoading(true); setError("");
    void installedMarket().then(items => { if (live) setApplications(items); }).catch(() => { if (live) setError("应用列表加载失败，请重新打开分享"); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [request?.id, user?.id]);
  useEffect(() => {
    if (!request) return;
    const back = BackHandler.addEventListener("hardwareBackPress", () => { if (!busyRef.current) sheet.current?.dismiss(); return true; });
    return () => back.remove();
  }, [request?.id]);
  const open = useEventCallback(async (appId: string) => {
    const item = current.current;
    if (!item || item.preparing || item.error || busyRef.current) return;
    if (!shellNavigationRef.isReady()) { setError("正在准备首页，请稍后重试"); return; }
    busyRef.current = true; setBusy(appId); setError("");
    let received = false;
    try {
      const result = await shell("incomingShareAccept", { id: item.id, appId });
      if (!result.ok) { setError(result.error === "busy" ? "该应用待处理分享过多，请先处理已有内容" : "接收未完成，请重试"); return; }
      received = true; accepted.current = true; closing.current = true; sheet.current?.dismiss();
      await openShellBundle(appId);
    } catch (cause) {
      if (received) Toast.show({ type: "error", text1: "内容已接收，应用打开失败，请从常用重试" });
      else setError("接收未完成，请重试");
    } finally { busyRef.current = false; setBusy(""); if (!current.current) refreshRef.current(); }
  });
  const dismiss = useEventCallback(() => {
    const item = current.current;
    const discard = item && !accepted.current;
    current.current = undefined; setRequest(undefined);
    closing.current = false;
    if (discard) void shell("incomingShareDiscard", { id: item.id }).catch(() => {}).finally(() => refreshRef.current());
    else refreshRef.current();
  });
  const backdrop = useCallback((props: Parameters<typeof BottomSheetBackdrop>[0]) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.32} pressBehavior={busy ? "none" : "close"} />, [busy]);
  const render = useCallback(({ item }: { item: MarketApplication }) => <IncomingApplicationRow item={item} open={open} busy={busy === item.manifest.appId} disabled={!!busy || !!request?.preparing || !!request?.error} />, [open, busy, request?.preparing, request?.error]);
  return <BottomSheetModal ref={sheet} snapPoints={points} enableDynamicSizing={false} enableOverDrag={false} enablePanDownToClose={!busy} onDismiss={dismiss}
    backdropComponent={backdrop} backgroundStyle={{ backgroundColor: colors.surface, borderRadius: colors.radius.xxl }} handleIndicatorStyle={{ backgroundColor: colors.lineStrong }}>
    <View style={{ flex: 1 }}>
      <View style={{ padding: 20, gap: 8 }}>
        <Text style={{ color: colors.ink1, fontSize: 20, fontWeight: "700" }}>用应用打开</Text>
        <Text numberOfLines={2} style={{ color: colors.ink3, fontSize: 14 }}>{request?.title || request?.text || (request?.files.length ? `${request.files.length} 个文件` : "分享内容")}</Text>
        {request?.preparing ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><ActivityIndicator size="small" color={colors.ink3} /><Text style={{ color: colors.ink3 }}>正在接收文件…</Text></View> : null}
        {error || request?.error ? <Text style={{ color: colors.danger, fontSize: 13 }}>{error || request?.error}</Text> : null}
      </View>
      <AnimatedFlashList data={applications} renderItem={render} keyExtractor={key} renderScrollComponent={Scrollable} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Math.max(bottom, 16) }}
        ListEmptyComponent={loading ? <PageSkeleton rows={4} shape="picker" /> : <View style={{ padding: 24, alignItems: "center" }}><Text style={{ color: colors.ink3 }}>先打开一个应用，再将内容分享给它</Text></View>} />
    </View>
  </BottomSheetModal>;
}
const IncomingApplicationRow = memo(function IncomingApplicationRow({ item, open, busy, disabled }: { item: MarketApplication; open: (id: string) => void; busy: boolean; disabled: boolean }) {
  const { colors } = useTheme();
  return <Pressy accessibilityLabel={`用${item.manifest.appName}打开`} disabled={disabled} onPress={() => open(item.manifest.appId)} style={{ flexDirection: "row", gap: 14, alignItems: "center", minHeight: 76, paddingVertical: 12, opacity: disabled && !busy ? 0.5 : 1 }}>
    <ApplicationIcon application={item} size={48} />
    <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={{ color: colors.ink1, fontSize: 16, fontWeight: "600" }}>{item.manifest.appName}</Text><Text numberOfLines={1} style={{ color: colors.ink3, fontSize: 13 }}>{item.manifest.description}</Text></View>
    {busy ? <ActivityIndicator color={colors.accent} /> : <SymbolIcon name="arrow" size={18} color={colors.ink3} />}
  </Pressy>;
});
