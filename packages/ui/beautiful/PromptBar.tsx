import { useEffect, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../chrome/Icon";
import { Pressy } from "../chrome/Pressy";
import { Surface } from "../chrome/Surface";
import { EdgeModal } from "../edge";
import { themedStyleSheet, useTheme } from "../theme";

export type PromptBarVariant = "Rounded" | "Pill";

const PROVIDERS: PromptProvider[] = [{ id: "jules", name: "Jules", hint: "在云端改代码并打包" }];

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
  style?: StyleProp<ViewStyle>;
};

export function PromptBar({
  value: controlledValue,
  variant = "Rounded",
  busy = false,
  disabled = false,
  placeholder = "说说你想做什么小应用",
  providers = PROVIDERS,
  providerId,
  onProviderChange,
  onChange,
  onSend,
  onStop,
  style,
}: PromptBarProps) {
  const { colors } = useTheme();
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

  const canSend = value.trim().length > 0 && !busy && !disabled;
  const isPill = variant === "Pill";

  // 能发送时按钮从暗淡弹到实心，输入框聚焦时边框换成金色
  const ready = useSharedValue(canSend || busy ? 1 : 0);
  useEffect(() => {
    ready.value = withSpring(canSend || busy ? 1 : 0, { damping: 16, stiffness: 260 });
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
          <Surface tone="raised" radius={colors.radius.xl} lifted style={styles.menu}>
            <Text style={styles.menuTitle}>AI Agent</Text>
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
                      onPress={() => {
                        onProviderChange?.(item.id);
                        closeProviders();
                      }}
                      style={({ pressed }) => [styles.menuRow, (active || pressed) && styles.menuRowActive]}
                    >
                      <View style={styles.menuCopy}>
                        <Text style={[styles.menuRowLabel, active && styles.menuRowLabelActive]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.hint ? <Text style={styles.menuHint}>{item.hint}</Text> : null}
                      </View>
                      {active ? <Icon name="check" size={18} color={colors.accentText} strokeWidth={2.1} /> : null}
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
        radius={isPill ? colors.radius.pill : 26}
        lifted
        style={[styles.box, { borderColor: focused || busy ? colors.accentSoft : colors.lineStrong }]}
      >
        <TextInput
          value={value}
          onChangeText={setVal}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!busy}
          placeholder={placeholder}
          placeholderTextColor={colors.ink3}
          multiline={!isPill}
          textAlignVertical="top"
          style={[styles.input, isPill && styles.inputPill]}
        />

        <View style={styles.toolbar}>
          <Pressy
            accessibilityRole="button"
            accessibilityLabel="选择 AI Agent"
            onPress={() => setProviderOpen((open) => !open)}
            scale={0.95}
            style={styles.modelChip}
          >
            <View style={styles.modelDot} />
            <Text style={styles.modelLabel} numberOfLines={1}>
              {selected?.name ?? "Jules"}
            </Text>
          </Pressy>

          <View style={styles.rightActions}>
            {value.length > 0 && !busy ? (
              <Pressy accessibilityRole="button" onPress={() => setVal("")} hitSlop={8} scale={0.92} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>清空</Text>
              </Pressy>
            ) : null}

            <Animated.View style={sendMotion}>
              <Pressy
                accessibilityRole="button"
                accessibilityLabel={busy ? "暂停" : "开始制作"}
                disabled={busy ? false : !canSend}
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

const styles = themedStyleSheet((t) => ({
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
    borderRadius: 16,
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
    borderRadius: 21,
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
    backgroundColor: "rgba(8, 5, 12, 0.55)",
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
