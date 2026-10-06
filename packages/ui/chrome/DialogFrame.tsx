import { useEffect, type ReactNode } from "react";
import { BackHandler, StyleSheet, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { Dialog, ScrollView, YStack } from "tamagui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";

/** Host dialog policy; applications use Tamagui directly. */
export function DialogFrame({ open, onClose, children, style, dismissible = true, title = "提示" }: {
  open: boolean; onClose: () => void; children: ReactNode; style?: StyleProp<ViewStyle>; dismissible?: boolean; title?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  useEffect(() => {
    if (!open) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { if (dismissible) onClose(); return true; });
    return () => subscription.remove();
  }, [open, dismissible, onClose]);
  return <Dialog modal open={open} onOpenChange={value => { if (!value && dismissible) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay backgroundColor={colors.mode === "dark" ? "rgba(0,0,0,0.5)" : "rgba(20,23,34,0.32)"}
        onPress={() => { if (dismissible) onClose(); }} />
      <Dialog.Content width="90%" maxWidth={400} maxHeight={Math.max(180, height - insets.top - insets.bottom - 48)}
        backgroundColor={colors.canvas} borderRadius={colors.components.dialogRadius} padding={0}
        borderWidth={0.5} borderColor={colors.lineStrong} overflow="hidden"
        onInteractOutside={(event: { preventDefault: () => void }) => { if (!dismissible) event.preventDefault(); }}
        onEscapeKeyDown={(event: { preventDefault: () => void }) => { if (!dismissible) event.preventDefault(); }}>
        <Dialog.Title display="none">{title}</Dialog.Title>
        <YStack height={4} backgroundColor={colors.accent} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 10, ...StyleSheet.flatten(style) }}>
          {children}
        </ScrollView>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog>;
}
