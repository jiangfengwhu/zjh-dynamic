import { PixelText as Text } from "./feed/PixelText";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import {
  useNotificationCount,
  useNotificationSync,
} from "./feed/notifications";
import { PixelIcon } from "./feed/PixelKit";
import { pixelTheme } from "./feed/pixelTheme";

export const SHELL_TABS = [
  { id: "feed", title: "动态", icon: "feed" },
  { id: "market", title: "应用市场", icon: "box" },
  { id: "notifications", title: "通知", icon: "bell" },
] as const;
export type ShellTabId = (typeof SHELL_TABS)[number]["id"];

export function TabBar({
  activeId,
  onChange,
}: {
  activeId: string;
  onChange: (id: ShellTabId) => void;
}) {
  useTheme();
  const unread = useNotificationCount();
  useNotificationSync();
  return (
    <View style={[styles.bar, activeId === "feed" && pixelStyles.bar]}>
      {SHELL_TABS.map((item) => (
        <Tab
          key={item.id}
          item={item}
          pixel={activeId === "feed"}
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
  pixel,
  active,
  unread,
  onPress,
}: {
  item: (typeof SHELL_TABS)[number];
  pixel: boolean;
  active: boolean;
  unread: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const colors = pixel ? pixelTheme(theme.colors) : theme.colors;
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    progress.value = withSpring(active ? 1 : 0, {
      damping: 22,
      stiffness: 300,
      reduceMotion: ReduceMotion.System,
    });
  }, [active, progress]);
  const motion = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.9 + progress.value * 0.1 }],
  }));
  return (
    <Pressy
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={item.title + (unread ? `，${unread}条未读通知` : "")}
      style={styles.tab}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.selected, pixel && pixelStyles.selected, motion]}
      />
      <View style={styles.icon}>
        <PixelIcon
          name={item.icon}
          size={20}
          color={active ? colors.onAccent : colors.ink3}
        />
        {unread > 0 ? (
          <View
            style={[
              styles.unread,
              pixel && { borderRadius: 0 },
              { backgroundColor: active ? colors.onAccent : colors.accentText },
            ]}
          />
        ) : null}
      </View>
      <Text
        pixel={pixel}
        numberOfLines={1}
        style={[
          styles.label,
          pixel && { color: colors.ink3 },
          active && { color: colors.onAccent, fontWeight: "700" },
        ]}
      >
        {item.title}
      </Text>
    </Pressy>
  );
}
const styles = themedStyleSheet((t) => ({
  bar: {
    flexDirection: "row",
    backgroundColor: t.canvas,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 0.5,
    borderTopColor: t.line,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  selected: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: t.radius.sm,
    backgroundColor: t.accent,
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
  label: { fontSize: 12, lineHeight: 17, color: t.ink3, flexShrink: 1 },
}));
const pixelStyles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    bar: {
      backgroundColor: t.canvas,
      borderTopWidth: 0.5,
      borderTopColor: t.line,
    },
    selected: {
      borderRadius: 0,
      borderWidth: 2,
      borderColor: t.accentSoft,
      backgroundColor: t.accent,
    },
  };
});
