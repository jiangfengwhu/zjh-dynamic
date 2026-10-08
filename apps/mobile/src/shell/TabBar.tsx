import { HostText as Text } from "./feed/HostText";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import { createThemedStyles, useTheme } from "../../../../packages/ui/theme";
import {
  useNotificationCount,
} from "./feed/notifications";
import { useMessageCount, useMessagesSync } from "./social/api";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";


export const SHELL_TABS = [
  { id: "feed", title: "动态", icon: "feed" },
  { id: "market", title: "应用市场", icon: "box" },
  { id: "notifications", title: "通知", icon: "bell" },
  { id: "mine", title: "我的", icon: "mine" },
] as const;
export type ShellTabId = (typeof SHELL_TABS)[number]["id"];

export function TabBar({
  activeId,
  onChange,
  onCompose,
}: {
  activeId: string;
  onChange: (id: ShellTabId) => void;
  onCompose: () => void;
}) {
  const styles = useStyles();

  const colors = useTheme().colors;
  const unread = useNotificationCount() + useMessageCount();
  useMessagesSync();
  return (
    <View style={styles.bar}>
      {SHELL_TABS.slice(0, 2).map((item) => (
        <Tab
          key={item.id}
          item={item}
          active={item.id === activeId}
          unread={item.id === "notifications" ? unread : 0}
          onPress={() => onChange(item.id)}
        />
      ))}
      <View style={styles.composeSlot}>
        <Pressy
          accessibilityRole="button"
          accessibilityLabel="发布动态或制作应用"
          onPress={onCompose}
          scale={0.92}
          style={styles.compose}
        >
          <SymbolIcon name="plus" size={24} strokeWidth={2.4} color={colors.onAccent} />
        </Pressy>
      </View>
      {SHELL_TABS.slice(2).map((item) => (
        <Tab
          key={item.id}
          item={item}
          active={item.id === activeId}
          unread={item.id === "notifications" ? unread : 0}
          onPress={() => onChange(item.id)}
        />
      ))}
    </View>
  );
}
function Tab({
  item,
  active,
  unread,
  onPress,
}: {
  item: (typeof SHELL_TABS)[number];
  active: boolean;
  unread: number;
  onPress: () => void;
}) {
  const styles = useStyles();

  const theme = useTheme();
  const colors = theme.colors;
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(active ? 1 : 0, {
      duration: 180,
      reduceMotion: ReduceMotion.System,
    });
  }, [active, progress]);
  const motion = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: interpolate(progress.value, [0, 1], [0.6, 1]) }],
  }));
  return (
    <Pressy
      onPress={onPress}
      scale={0.94}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.title + (unread ? `，${unread}条未读通知` : "")}
      style={styles.tab}
    >
      <View style={styles.icon}>
        <Animated.View pointerEvents="none" style={[styles.selected, motion]} />
        <SymbolIcon
          name={item.icon}
          size={22}
          strokeWidth={active ? 2.2 : 1.8}
          color={active ? colors.ink1 : colors.ink3}
        />
        {unread > 0 ? <View style={styles.unread} /> : null}
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          active && { color: colors.ink1, fontWeight: "700" },
        ]}
      >
        {item.title}
      </Text>
    </Pressy>
  );
}
const useStyles = createThemedStyles((base) => {
  const t = base;
  return {
    bar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.surface,
      marginHorizontal: 16,
      height: 68,
      borderRadius: 34,
      paddingHorizontal: 6,
      borderWidth: t.components.surfaceBorder,
      borderColor: t.line,
      boxShadow: `0 10px 30px ${t.shade}`,
    },
    tab: {
      flex: 1,
      minWidth: 0,
      minHeight: 56,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    selected: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      borderRadius: 15,
      backgroundColor: t.surfaceRaised,
    },
    icon: { width: 52, height: 30, alignItems: "center", justifyContent: "center" },
    unread: {
      position: "absolute",
      right: 12,
      top: 2,
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: t.surface,
      backgroundColor: t.accent,
    },
    label: { fontSize: 11, lineHeight: 14, color: t.ink3, flexShrink: 1 },
    composeSlot: { paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
    compose: {
      width: 58,
      height: 46,
      minWidth: 58,
      minHeight: 46,
      padding: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.accent,
      boxShadow: `0 6px 16px ${t.accent}55`,
    },
  };
});
