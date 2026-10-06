import { useEffect, useId, type ReactNode } from "react";
import { Toast, ToastProvider, ToastViewport, Text, useToastController, useToastState } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";

type Notice = { type?: "success" | "error" | "warning" | "info"; text1?: string; text2?: string; visibilityTime?: number; onPress?: () => void };
let send: ((notice: Notice) => void) | undefined;
let queued: Notice | undefined;
const viewports: string[] = [];
const changes = new Set<() => void>();
export const notify = {
  show(notice: Notice) { if (send) send(notice); else queued = notice; },
};
export function NotificationProvider({ children }: { children: ReactNode }) {
  return <ToastProvider label="提示" duration={4200} swipeDirection="up">
    {children}<CurrentToast />
  </ToastProvider>;
}
function CurrentToast() {
  const controller = useToastController();
  const current = useToastState();
  const { colors } = useTheme();
  useEffect(() => {
    const handler = (notice: Notice) => controller.show(notice.text1 || "提示", {
      message: notice.text2, duration: notice.visibilityTime ?? 4200,
      viewportName: viewports.at(-1) ?? "default", tone: notice.type ?? "info", action: notice.onPress,
    });
    send = handler;
    if (queued) { const notice = queued; queued = undefined; handler(notice); }
    return () => { if (send === handler) send = undefined; };
  }, [controller]);
  useEffect(() => {
    const reroute = () => {
      if (!current || current.isHandledNatively) return;
      const viewportName = viewports.at(-1) ?? "default";
      if (current.viewportName !== viewportName) controller.show(current.title, { ...current, viewportName });
    };
    changes.add(reroute); return () => { changes.delete(reroute); };
  }, [controller, current]);
  if (!current || current.isHandledNatively) return null;
  const tone = current.tone === "error" ? colors.redText : current.tone === "success" ? colors.greenText : colors.accentText;
  return <Toast key={current.id} duration={current.duration} viewportName={current.viewportName}
    backgroundColor={colors.canvas} borderColor={colors.lineStrong} borderWidth={0.5}
    borderRadius={colors.components.dialogRadius} padding={12} width="100%" maxWidth={420}
    onOpenChange={open => { if (!open) controller.hide(); }} accessibilityLiveRegion="polite">
    <Toast.Title color={tone} fontFamily="$body" fontSize={14} onPress={() => { current.action?.(); controller.hide(); }}>{current.title}</Toast.Title>
    {current.message ? <Toast.Description color={colors.ink2} fontFamily="$body" fontSize={12}>{current.message}</Toast.Description> : null}
    <Toast.Close accessibilityLabel="关闭提示" minHeight={44} alignSelf="flex-end" paddingHorizontal={12}><Text fontFamily="$body" color={colors.ink3}>关闭</Text></Toast.Close>
  </Toast>;
}
export function NotificationViewport({ modal = false }: { modal?: boolean }) {
  const id = useId();
  const insets = useSafeAreaInsets();
  const name = modal ? `modal-${id}` : "default";
  useEffect(() => {
    if (!modal) return;
    viewports.push(name); changes.forEach(change => change());
    return () => { const index = viewports.indexOf(name); if (index >= 0) viewports.splice(index, 1); changes.forEach(change => change()); };
  }, [modal, name]);
  return <ToastViewport name={name} top={insets.top + 8} left={16} right={16} alignItems="center" zIndex={100000} />;
}
