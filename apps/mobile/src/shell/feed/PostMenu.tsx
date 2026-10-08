import { useCallback, useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  useBottomSheetTimingConfigs,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { ReduceMotion } from "react-native-reanimated";
import { SymbolIcon, type IconSymbol } from "../../../../../packages/ui/chrome/SymbolIcon";
import { HostText as Text } from "./HostText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../../../packages/ui/theme";

export function PostMenu({
  identity,
  onDelete,
  onCopy,
  onShare,
  busy = false,
}: {
  identity?: string;
  onDelete?: () => void;
  onCopy: () => void;
  onShare?: () => void;
  busy?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const modal = useRef<BottomSheetModal>(null);
  const pending = useRef<(() => void) | undefined>(undefined);
  const animation = useBottomSheetTimingConfigs({ duration: 180 });
  const backdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        opacity={0.46}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );
  useEffect(
    () => () => {
      pending.current = undefined;
      modal.current?.dismiss();
    },
    [identity]
  );
  function action(callback: () => void) {
    if (pending.current || busy) return;
    pending.current = callback;
    modal.current?.dismiss();
  }
  function dismissed() {
    const callback = pending.current;
    pending.current = undefined;
    if (callback) requestAnimationFrame(callback);
  }
  function row(
    label: string,
    icon: IconSymbol,
    tone: string,
    tint: string,
    callback: () => void
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => action(callback)}
        style={({ pressed }) => ({
          minHeight: 56,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 12,
          borderRadius: colors.radius.lg,
          backgroundColor: pressed ? colors.hover : colors.surface,
          opacity: busy ? 0.6 : 1,
        })}
      >
        <View style={{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: tint }}>
          <SymbolIcon name={icon} size={18} color={tone} />
        </View>
        <Text style={{ color: tone === colors.redText ? colors.redText : colors.ink1, fontSize: 15, fontWeight: "600" }}>{label}</Text>
      </Pressable>
    );
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="更多操作"
        disabled={busy}
        onPress={() => modal.current?.present()}
        style={{
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <SymbolIcon name="more" size={20} color={colors.ink3} />
      </Pressable>
      <BottomSheetModal
        ref={modal}
        enableDynamicSizing
        backdropComponent={backdrop}
        onDismiss={dismissed}
        animationConfigs={animation}
        overrideReduceMotion={ReduceMotion.System}
        backgroundStyle={{
          backgroundColor: colors.canvas,
          borderTopLeftRadius: colors.components.dialogRadius,
          borderTopRightRadius: colors.components.dialogRadius,
          borderWidth: colors.components.surfaceBorder,
          borderColor: colors.line,
        }}
        handleIndicatorStyle={{
          width: 36,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.lineStrong,
        }}
      >
        <BottomSheetView
          style={{
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 12 + insets.bottom,
            gap: 8,
          }}
        >
          <Text style={{ color: colors.ink1, fontSize: 17, lineHeight: 24, fontWeight: "800", paddingHorizontal: 4, paddingBottom: 4 }}>动态操作</Text>
          {row("复制文字", "layers", colors.cyanText, colors.cyanTint, onCopy)}
          {onShare
            ? row(
                "分享动态",
                "share",
                colors.accentText,
                colors.accentTint,
                onShare
              )
            : null}
          {onDelete
            ? row("删除", "close", colors.redText, colors.redTint, onDelete)
            : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => modal.current?.dismiss()}
            style={({ pressed }) => ({
              minHeight: 52,
              marginTop: 4,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? colors.hover2 : colors.surfaceRaised,
            })}
          >
            <Text style={{ color: colors.ink1, fontSize: 15, fontWeight: "700" }}>取消</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
