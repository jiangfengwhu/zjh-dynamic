import { useState } from "react";
import { BackHandler } from "react-native";
import { Button, Sheet, XStack } from "tamagui";
import { SymbolIcon, type IconSymbol } from "./PixelKit";
import { PixelText as Text } from "./PixelText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../../../packages/ui/theme";
import { useEffect } from "react";

export function PostMenu({ onDelete, onCopy, onShare, busy = false }: {
  onDelete?: () => void; onCopy: () => void; onShare?: () => void; busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { setOpen(false); return true; });
    return () => subscription.remove();
  }, [open]);
  function action(callback: () => void) {
    if (busy) return;
    setOpen(false);
    requestAnimationFrame(callback);
  }
  function row(label: string, icon: IconSymbol, tone: string, tint: string, callback: () => void) {
    return <Button disabled={busy} minHeight={48} justifyContent="flex-start" gap={10}
      backgroundColor={tint} color={tone} borderRadius={colors.components.controlRadius}
      fontFamily="$body" fontSize={14} icon={<SymbolIcon name={icon} size={18} color={tone} />}
      onPress={() => action(callback)}>{label}</Button>;
  }
  return <>
    <Button unstyled accessibilityLabel="更多操作" disabled={busy} width={44} height={44}
      alignItems="center" justifyContent="center" onPress={() => setOpen(true)}>
      <SymbolIcon name="more" size={21} color={colors.ink3} />
    </Button>
    <Sheet modal open={open} onOpenChange={setOpen} snapPointsMode="fit" dismissOnSnapToBottom moveOnKeyboardChange transition="fast">
      <Sheet.Overlay backgroundColor="rgba(0,0,0,0.46)" />
      <Sheet.Handle backgroundColor={colors.accent} width={32} height={4} borderRadius={2} marginBottom={8} />
      <Sheet.Frame padding={16} paddingBottom={12 + insets.bottom} gap={6} backgroundColor={colors.canvas}
        borderTopLeftRadius={colors.components.dialogRadius} borderTopRightRadius={colors.components.dialogRadius}>
        <XStack alignItems="center" gap={8} paddingBottom={6}>
          <SymbolIcon name="feed" size={18} color={colors.orchidText} /><Text style={{ fontSize: 16 }}>动态操作</Text>
        </XStack>
        {row("复制文字", "layers", colors.cyanText, colors.cyanTint, onCopy)}
        {onShare ? row("分享动态", "share", colors.orchidText, colors.orchidTint, onShare) : null}
        {onDelete ? row("删除", "close", colors.redText, colors.redTint, onDelete) : null}
        <Button chromeless fontFamily="$body" color={colors.ink3} minHeight={44} onPress={() => setOpen(false)}>取消</Button>
      </Sheet.Frame>
    </Sheet>
  </>;
}
