import { Text, TextInput } from "../primitives/Typography";
import { useEffect, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../chrome/Icon";
import { SymbolIcon } from "../chrome/SymbolIcon";
import { useTheme } from "../theme";
import { Pressy } from "../chrome/Pressy";
import { Surface } from "../chrome/Surface";
import { EdgeModal } from "../edge";
import { createThemedStyles } from "../theme";

export type PromptBarVariant = "Rounded" | "Pill";


export type PromptProvider = {
  id: string;
  name: string;
  hint?: string;
};

export type PromptBarProps = {
  value?: string;
  variant?: PromptBarVariant;
  busy?: boolean;
  disabled?: boolean;
  placeholder?: string;
  providers?: PromptProvider[];
  providerId?: string;
  onProviderChange?: (id: string) => void;
  onChange?: (value: string) => void;
  onSend?: (text: string) => void;
  onStop?: () => void;
  sendLabel?: string;
  stopLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function PromptBar({
  value: controlledValue,
  variant = "Rounded",
  busy = false,
  disabled = false,
  placeholder = "输入内容",
  providers = [],
  providerId,
  onProviderChange,
  onChange,
  onSend,
  onStop,
  sendLabel = "发送",
  stopLabel = "停止",
  style,
}: PromptBarProps) {
  const styles = useStyles();

  const { colors } = useTheme();
  const { colors: popupColors } = useTheme();
  const [internalVal, setInternalVal] = useState("");
  const value = controlledValue ?? internalVal;
  const setVal = (next: string) => {
    setInternalVal(next);
    onChange?.(next);
  };

  const [providerOpen, setProviderOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = providers.find((item) => item.id === providerId) ?? providers[0];
  const closeProviders = () => setProviderOpen(false);
  const listHeight = Math.min(280, Math.max(providers.length, 1) * PROVIDER_ROW_HEIGHT);

  const canSend = value.trim().length > 0 && !busy && !disabled && Boolean(onSend);
  const isPill = variant === "Pill";

  // 能发送时按钮从暗淡弹到实心，输入框聚焦时边框换成金色
  const ready = useSharedValue(canSend || busy ? 1 : 0);
  useEffect(() => {
    ready.value = withSpring(canSend || busy ? 1 : 0, { damping: 16, stiffness: 260, reduceMotion: ReduceMotion.System });
  }, [busy, canSend, ready]);
  const sendMotion = useAnimatedStyle(() => ({
    opacity: 0.38 + ready.value * 0.62,
    transform: [{ scale: 0.9 + ready.value * 0.1 }],
  }));

  return (
    <View style={[styles.anchor, style]}>
      <EdgeModal visible={providerOpen} transparent animationType="fade" onRequestClose={closeProviders}>
        <View style={[styles.backdrop, { paddingBottom: insets.bottom }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭提供商列表"
            style={StyleSheet.absoluteFill}
            onPress={closeProviders}
          />
          <Surface tone="raised" radius={colors.components.dialogRadius} style={[styles.menu, { backgroundColor: popupColors.canvas, borderWidth: 0.5, borderColor: popupColors.lineStrong, overflow: "hidden" }]}>
            <View style={{ height: 4, backgroundColor: popupColors.accent }} />
            <Text style={[styles.menuTitle, { fontFamily: popupColors.typography.body, color: popupColors.ink1 }]}>AI 引擎</Text>
            <View style={[styles.menuScroll, { height: listHeight }]}>
              <FlatList
                data={providers}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={12}
                getItemLayout={(_item, index) => ({
                  length: PROVIDER_ROW_HEIGHT,
                  offset: PROVIDER_ROW_HEIGHT * index,
                  index,
                })}
                renderItem={({ item }) => {
                  const active = item.id === selected?.id;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => {
                        onProviderChange?.(item.id);
                        closeProviders();
                      }}
                      style={({ pressed }) => [styles.menuRow, (active || pressed) && { backgroundColor: popupColors.accentTint }]}
                    >
                      <View style={styles.menuCopy}>
                        <Text style={[styles.menuRowLabel, { fontFamily: popupColors.typography.body, color: active ? popupColors.accentText : popupColors.ink2 }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.hint ? <Text style={[styles.menuHint, { fontFamily: popupColors.typography.body, color: popupColors.ink3 }]}>{item.hint}</Text> : null}
                      </View>
                      {active ? <SymbolIcon name="check" size={18} color={popupColors.accentText} /> : null}
                    </Pressable>
                  );
                }}
              />
            </View>
          </Surface>
        </View>
      </EdgeModal>

      <Surface
        tone="raised"
        radius={isPill ? colors.radius.pill : colors.components.controlRadius}
        lifted
        style={[styles.box, { borderColor: focused || busy ? colors.accentSoft : colors.lineStrong }]}
      >
        <TextInput
          accessibilityLabel={placeholder}
          value={value}
          onChangeText={setVal}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!busy && !disabled}
          placeholder={placeholder}
          placeholderTextColor={colors.ink3}
          multiline={!isPill}
          textAlignVertical="top"
          style={[styles.input, isPill && styles.inputPill]}
        />

        <View style={styles.toolbar}>
          {providers.length > 0 && <Pressy
            disabled={disabled || busy}
            accessibilityRole="button"
            accessibilityLabel="选择引擎"
            onPress={() => setProviderOpen((open) => !open)}
            scale={0.95}
            style={styles.modelChip}
          >
            <View style={styles.modelDot} />
            <Text style={styles.modelLabel} numberOfLines={1}>
              {selected?.name ?? "选择引擎"}
            </Text>
          </Pressy>}

          <View style={styles.rightActions}>
            {value.length > 0 && !busy && !disabled ? (
              <Pressy accessibilityRole="button" onPress={() => setVal("")} hitSlop={8} scale={0.92} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>清空</Text>
              </Pressy>
            ) : null}

            <Animated.View style={sendMotion}>
              <Pressy
                accessibilityRole="button"
                accessibilityLabel={busy ? stopLabel : sendLabel}
                disabled={disabled || (busy ? !onStop : !canSend)}
                onPress={() => (busy ? onStop?.() : onSend?.(value.trim()))}
                scale={0.9}
                style={[styles.sendBtn, busy && styles.sendBtnStop]}
              >
                <Icon
                  name={busy ? "stop" : "send"}
                  size={busy ? 20 : 22}
                  color={busy ? colors.redText : colors.onAccent}
                  strokeWidth={busy ? 1.6 : 2.2}
                />
              </Pressy>
            </Animated.View>
          </View>
        </View>
      </Surface>
    </View>
  );
}

const PROVIDER_ROW_HEIGHT = 58;

const useStyles = createThemedStyles((t) => ({
  anchor: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    position: "relative",
    backgroundColor: t.canvas,
  },
  box: {
    paddingLeft: 18,
    paddingRight: 10,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 6,
  },
  input: {
    minHeight: 24,
    maxHeight: 120,
    paddingTop: Platform.OS === "ios" ? 1 : 0,
    paddingBottom: 0,
    margin: 0,
    color: t.ink1,
    fontSize: 16,
    lineHeight: 24,
    includeFontPadding: false,
    textAlignVertical: "top",
  },
  inputPill: {
    maxHeight: 24,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  modelChip: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    maxWidth: "58%",
    paddingHorizontal: 12,
    borderRadius: t.components.controlRadius,
    backgroundColor: t.inset,
  },
  modelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: t.accent,
  },
  modelLabel: {
    flexShrink: 1,
    color: t.ink2,
    fontSize: 12.5,
    lineHeight: 16,
    fontWeight: "600",
    includeFontPadding: false,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clearBtn: {
    height: 32,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: t.ink3,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: t.components.controlRadius,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.accent,
  },
  sendBtnStop: {
    backgroundColor: t.redTint,
    borderWidth: 1,
    borderColor: t.red,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(25,21,44,0.46)",
  },
  menu: {
    marginHorizontal: 14,
    marginBottom: 12,
    maxHeight: 380,
  },
  menuTitle: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    fontFamily: t.serif,
    fontSize: 17,
    fontWeight: "700",
    color: t.ink1,
  },
  menuScroll: {
    height: 280,
  },
  menuRow: {
    height: PROVIDER_ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 20,
  },
  menuRowActive: {
    backgroundColor: t.accentTint,
  },
  menuCopy: {
    flex: 1,
    gap: 1,
  },
  menuRowLabel: {
    color: t.ink2,
    fontSize: 15,
    fontWeight: "500",
  },
  menuHint: {
    fontSize: 12,
    color: t.ink3,
  },
  menuRowLabelActive: {
    color: t.accentText,
    fontWeight: "700",
  },
}));
