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
import { SymbolIcon, type IconSymbol } from "./PixelKit";
import { PixelText as Text } from "./PixelText";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../../../../packages/ui/theme";

export function PostMenu({
  onDelete,
  onCopy,
  onShare,
  busy = false,
}: {
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
    []
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
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 12,
          borderRadius: colors.components.controlRadius,
          backgroundColor: tint,
          opacity: pressed || busy ? 0.7 : 1,
        })}
      >
        <SymbolIcon name={icon} size={18} color={tone} />
        <Text style={{ color: tone, fontSize: 14 }}>{label}</Text>
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
        <SymbolIcon name="more" size={21} color={colors.ink3} />
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
          borderWidth: 0.5,
          borderColor: colors.lineStrong,
        }}
        handleIndicatorStyle={{
          width: 32,
          height: 4,
          borderRadius: colors.radius.sm,
          backgroundColor: colors.accent,
        }}
      >
        <BottomSheetView
          style={{
            paddingHorizontal: 16,
            paddingBottom: 12 + insets.bottom,
            gap: 6,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingBottom: 6,
            }}
          >
            <SymbolIcon name="feed" size={18} color={colors.orchidText} />
            <Text style={{ color: colors.ink1, fontSize: 16 }}>动态操作</Text>
          </View>
          {row("复制文字", "layers", colors.cyanText, colors.cyanTint, onCopy)}
          {onShare
            ? row(
                "分享动态",
                "share",
                colors.orchidText,
                colors.orchidTint,
                onShare
              )
            : null}
          {onDelete
            ? row("删除", "close", colors.redText, colors.redTint, onDelete)
            : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => modal.current?.dismiss()}
            style={{
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: colors.ink3, fontSize: 13 }}>取消</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}
