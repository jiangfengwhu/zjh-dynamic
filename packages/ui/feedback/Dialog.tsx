import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { DialogFrame } from "../chrome/DialogFrame";
import { Text } from "../primitives/Typography";
import { Button } from "../primitives/Button";
import { useTheme } from "../theme";

export type DialogProps = { open: boolean; onClose: () => void; title: string; children?: ReactNode; footer?: ReactNode; dismissible?: boolean };
export function Dialog({ open, onClose, title, children, footer, dismissible = true }: DialogProps) {
  const { colors } = useTheme();
  return <DialogFrame open={open} onClose={onClose} dismissible={dismissible}>
    <View style={{ gap: colors.spacing.item }}>
      <Text variant="title" accessibilityRole="header">{title}</Text>
      {children}
    </View>
    {footer ? <View style={{ paddingTop: colors.spacing.item }}>{footer}</View> : null}
  </DialogFrame>;
}
export type ConfirmDialogProps = Omit<DialogProps, "children" | "footer" | "dismissible"> & {
  description: string; confirmLabel: string; cancelLabel?: string; intent?: "brand" | "danger"; onConfirm: () => void | Promise<void>;
};
export function ConfirmDialog(props: ConfirmDialogProps) {
  // Unmount per opening so errors do not survive a dismissed confirmation.
  return props.open ? <Confirmation {...props} /> : null;
}
function Confirmation({ description, confirmLabel, cancelLabel = "取消", intent = "danger", onConfirm, ...props }: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const { colors } = useTheme();
  async function confirm() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await onConfirm(); if (alive.current) props.onClose(); }
    catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : "操作未完成，请重试"); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return <Dialog {...props} dismissible={!busy} onClose={() => { if (!pending.current) props.onClose(); }}
    footer={<View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      <Button label={cancelLabel} variant="outline" intent="neutral" disabled={busy} onPress={props.onClose} />
      <Button label={confirmLabel} intent={intent} busy={busy} onPress={() => void confirm()} />
    </View>}>
    <Text>{description}</Text>
    {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.redText }}>{error}</Text> : null}
  </Dialog>;
}
