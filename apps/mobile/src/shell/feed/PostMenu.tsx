import { useCallback, useEffect, useRef } from "react";
import { Text } from "react-native";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { PixelIcon } from "./PixelKit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressy } from "../../../../../packages/ui/chrome";
import { useTheme } from "../../../../../packages/ui/theme";

export function PostMenu({ onDelete, onCopy, onShare, busy = false }: { onDelete?: () => void; onCopy: () => void; onShare?: () => void; busy?: boolean }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme(); const modal = useRef<BottomSheetModal>(null);
  const backdrop = useCallback((props: BottomSheetBackdropProps) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />, []);
  useEffect(() => () => { modal.current?.dismiss(); }, []);
  function action(callback: () => void) { modal.current?.dismiss(); callback(); }
  return <>
    <Pressy accessibilityRole="button" accessibilityLabel="更多操作" disabled={busy} onPress={() => modal.current?.present()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><PixelIcon name="more" size={21} color={colors.ink3} /></Pressy>
    <BottomSheetModal ref={modal} enableDynamicSizing backdropComponent={backdrop} backgroundStyle={{ backgroundColor: colors.surfaceRaised }} handleIndicatorStyle={{ backgroundColor: colors.ink3 }}>
      <BottomSheetView style={{ padding: 16, paddingBottom: 12 + insets.bottom, gap: 4 }}>
        <Pressy accessibilityRole="button" onPress={() => action(onCopy)} style={{ paddingHorizontal: 12, paddingVertical: 10 }}><Text style={{ color: colors.ink1, fontSize: 14 }}>复制文字</Text></Pressy>
        {onShare ? <Pressy accessibilityRole="button" onPress={() => action(onShare)} style={{ paddingHorizontal: 12, paddingVertical: 10 }}><Text style={{ color: colors.ink1, fontSize: 14 }}>分享动态</Text></Pressy> : null}
        {onDelete ? <Pressy accessibilityRole="button" onPress={() => action(onDelete)} style={{ paddingHorizontal: 12, paddingVertical: 10 }}><Text style={{ color: colors.danger, fontSize: 14 }}>删除</Text></Pressy> : null}
        <Pressy accessibilityRole="button" onPress={() => modal.current?.dismiss()} style={{ paddingHorizontal: 12, paddingVertical: 10 }}><Text style={{ color: colors.ink3, textAlign: "center", fontSize: 14 }}>取消</Text></Pressy>
      </BottomSheetView>
    </BottomSheetModal>
  </>;
}
