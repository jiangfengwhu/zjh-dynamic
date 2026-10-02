import { useCallback, useEffect, useRef } from "react";
import { Pressable, Text } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { MoreHorizontal } from "lucide-react-native";
import { useTheme } from "../../../../../packages/ui/theme";

export function PostMenu({ onDelete, onCopy, onShare, busy = false }: { onDelete?: () => void; onCopy: () => void; onShare?: () => void; busy?: boolean }) {
  const { colors } = useTheme(); const modal = useRef<BottomSheetModal>(null);
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />, []);
  useEffect(() => () => { modal.current?.dismiss(); }, []);
  function action(callback: () => void) { modal.current?.dismiss(); callback(); }
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="更多操作" disabled={busy} onPress={() => modal.current?.present()} hitSlop={8} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><MoreHorizontal size={21} color={colors.ink3} /></Pressable>
    <BottomSheetModal ref={modal} enableDynamicSizing backdropComponent={backdrop} backgroundStyle={{ backgroundColor: colors.surfaceRaised }} handleIndicatorStyle={{ backgroundColor: colors.ink3 }}>
      <BottomSheetView style={{ padding: 16, paddingBottom: 36, gap: 4 }}>
        <Pressable accessibilityRole="button" onPress={() => action(onCopy)} style={{ padding: 16 }}><Text style={{ color: colors.ink1, fontSize: 16 }}>复制文字</Text></Pressable>
        {onShare ? <Pressable accessibilityRole="button" onPress={() => action(onShare)} style={{ padding: 16 }}><Text style={{ color: colors.ink1, fontSize: 16 }}>分享动态</Text></Pressable> : null}
        {onDelete ? <Pressable accessibilityRole="button" onPress={() => action(onDelete)} style={{ padding: 16 }}><Text style={{ color: colors.danger, fontSize: 16 }}>删除</Text></Pressable> : null}
        <Pressable accessibilityRole="button" onPress={() => modal.current?.dismiss()} style={{ padding: 16 }}><Text style={{ color: colors.ink3, textAlign: "center", fontSize: 16 }}>取消</Text></Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  </>;
}
