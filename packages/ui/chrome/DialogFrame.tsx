import type { ReactNode } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EdgeModal } from "../edge";
import { ThemeContext } from "../theme";
import { useTheme } from "../theme";

/** Shared dialog frame; public dialog props and app callbacks stay unchanged. */
export function DialogFrame({
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
  const value = useTheme();
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
        onRequestClose={dismissible ? onClose : () => {}}
      >
        <KeyboardAvoidingView
          behavior="padding"
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
              backgroundColor: colors.mode === "dark" ? "rgba(0,0,0,0.62)" : "rgba(12,12,16,0.38)",
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
                backgroundColor: colors.surface,
                borderWidth: colors.components.surfaceBorder,
                borderColor: colors.line,
                borderRadius: colors.components.dialogRadius,
                overflow: "hidden",
                boxShadow: `0 20px 48px ${colors.shade}`,
              },
              frame,
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ flexShrink: 1 }}
              contentContainerStyle={[{ padding: 22, gap: 12 }, spacing]}
            >
              {children}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </EdgeModal>
    </ThemeContext.Provider>
  );
}
