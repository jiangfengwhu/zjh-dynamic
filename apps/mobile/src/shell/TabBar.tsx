import { HostText as Text } from "./feed/HostText";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  ReduceMotion,
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
      <Pressy
        accessibilityRole="button"
        accessibilityLabel="发布动态或制作应用"
        onPress={onCompose}
        scale={1}
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          alignSelf: "center",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.accent,
        }}
      >
        <SymbolIcon name="plus" size={22} color={colors.onAccent} />
      </Pressy>
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
      duration: 150,
      reduceMotion: ReduceMotion.System,
    });
  }, [active, progress]);
  const motion = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  return (
    <Pressy
      onPress={onPress}
      scale={1}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.title + (unread ? `，${unread}条未读通知` : "")}
      style={styles.tab}
    >
      <Animated.View pointerEvents="none" style={[styles.selected, motion]} />
      <View style={styles.icon}>
        <SymbolIcon
          name={item.icon}
          size={22}
          color={active ? colors.ink1 : colors.ink3}
        />
        {unread > 0 ? (
          <View
            style={[
              styles.unread,
              { backgroundColor: active ? colors.onAccent : colors.accentText },
            ]}
          />
        ) : null}
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
      backgroundColor: t.surface,
      marginHorizontal: 16,
      borderRadius: t.radius.lg,
      paddingHorizontal: 6,
      paddingVertical: 8,
      gap: 4,
      borderWidth: 1,
      borderColor: t.line,
    },
    tab: {
      flex: 1,
      minWidth: 0,
      minHeight: 48,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    selected: {
      position: "absolute",
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      borderRadius: t.radius.md,
      backgroundColor: t.amberTint,
    },
    icon: { alignItems: "center", justifyContent: "center" },
    unread: {
      position: "absolute",
      right: -3,
      top: -2,
      width: 5,
      height: 5,
      borderRadius: 3,
    },
    label: { fontSize: 11, lineHeight: 16, color: t.ink3, flexShrink: 1 },
  };
});
