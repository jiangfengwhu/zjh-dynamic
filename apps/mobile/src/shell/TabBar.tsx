import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Icon, Pressy } from "../../../../packages/ui/chrome";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { useNotificationCount, useNotificationSync } from "./feed/notifications";

export const SHELL_TABS = [
  { id: "feed", title: "动态", icon: "feed" },
  { id: "market", title: "应用市场", icon: "box" },
  { id: "mine", title: "我的", icon: "mine" },
] as const;
export type ShellTabId = (typeof SHELL_TABS)[number]["id"];

export function TabBar({ activeId, onChange }: { activeId: string; onChange: (id: ShellTabId) => void }) {
  useTheme();
  const unread = useNotificationCount();
  useNotificationSync();
  return <View style={styles.bar}>{SHELL_TABS.map(item =>
    <Tab key={item.id} item={item} active={item.id === activeId}
      unread={item.id === "feed" ? unread : 0} onPress={() => onChange(item.id)} />
  )}</View>;
}
function Tab({ item, active, unread, onPress }: {
  item: (typeof SHELL_TABS)[number]; active: boolean; unread: number; onPress: () => void;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => { progress.value = withTiming(active ? 1 : 0, { duration: 160, reduceMotion: ReduceMotion.System }); }, [active, progress]);
  const motion = useAnimatedStyle(() => ({ opacity: 0.72 + progress.value * 0.28, transform: [{ translateY: -progress.value }] }));
  return <Pressy onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }}
    accessibilityLabel={item.title + (unread ? `，${unread}条未读通知` : "")} style={styles.tab}>
    <Animated.View style={[styles.icon, motion]}>
      <Icon name={item.icon} size={21} color={active ? colors.accentText : colors.ink3} />
      {unread > 0 ? <View style={[styles.unread, { backgroundColor: colors.accent }]} /> : null}
    </Animated.View>
    <Text style={[styles.label, active && { color: colors.accentText, fontWeight: "600" }]}>{item.title}</Text>
  </Pressy>;
}
const styles = themedStyleSheet(t => ({
  bar: { flexDirection: "row", backgroundColor: t.canvas, borderTopWidth: 0.5, borderTopColor: t.line },
  tab: { flex: 1, height: 56, alignItems: "center", justifyContent: "center", gap: 3 },
  icon: { width: 26, height: 24, alignItems: "center", justifyContent: "center" },
  unread: { position: "absolute", right: -1, top: 0, width: 6, height: 6, borderRadius: 3 },
  label: { fontSize: 10.5, lineHeight: 14, color: t.ink3 },
}));
