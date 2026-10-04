import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EdgeModal } from "../edge";
import { ThemeContext } from "../theme";
import { usePixelTheme } from "../pixelTheme";

/** Shared dialog frame; public dialog props and app callbacks stay unchanged. */
export function PixelPopup({
  open,
  onClose,
  children,
  style,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  dismissible?: boolean;
}) {
  const value = usePixelTheme();
  const { colors } = value;
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const spacingKeys = new Set([
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "paddingHorizontal",
    "paddingVertical",
    "gap",
    "rowGap",
    "columnGap",
  ]);
  const supplied = Object.entries(StyleSheet.flatten(style) ?? {});
  const frame = Object.fromEntries(
    supplied.filter(([key]) => !spacingKeys.has(key))
  );
  const spacing = Object.fromEntries(
    supplied.filter(([key]) => spacingKeys.has(key))
  );
  return (
    <ThemeContext.Provider value={value}>
      <EdgeModal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <Pressable
            accessible={dismissible}
            accessibilityRole="button"
            accessibilityLabel="关闭弹窗"
            onPress={dismissible ? onClose : undefined}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(25,21,44,0.46)",
            }}
          />
          <View
            accessibilityViewIsModal
            style={[
              {
                width: "100%",
                maxWidth: 400,
                maxHeight: Math.max(
                  180,
                  height - insets.top - insets.bottom - 48
                ),
                backgroundColor: colors.canvas,
                borderWidth: 0.5,
                borderColor: colors.lineStrong,
                borderRadius: 12,
                overflow: "hidden",
              },
              frame,
            ]}
          >
            <View style={{ height: 4, backgroundColor: colors.accent }} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
              contentContainerStyle={[{ padding: 16, gap: 10 }, spacing]}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </EdgeModal>
    </ThemeContext.Provider>
  );
}
