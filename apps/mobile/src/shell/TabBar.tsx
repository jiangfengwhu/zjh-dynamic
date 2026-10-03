import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
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
  return <View style={styles.bar}>{SHELL_TABS.map(item => <Tab key={item.id} item={item} active={item.id === activeId} unread={item.id === "feed" ? unread : 0} onPress={() => onChange(item.id)} />)}</View>;
}
function Tab({ item, active, unread, onPress }: { item: (typeof SHELL_TABS)[number]; active: boolean; unread: number; onPress: () => void }) {
  const { colors } = useTheme();
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => { progress.value = withSpring(active ? 1 : 0, { damping: 22, stiffness: 300, reduceMotion: ReduceMotion.System }); }, [active, progress]);
  const motion = useAnimatedStyle(() => ({ opacity: progress.value, transform: [{ scale: 0.9 + progress.value * 0.1 }] }));
  return <Pressy onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={item.title + (unread ? `，${unread}条未读通知` : "")} style={styles.tab}>
    <Animated.View pointerEvents="none" style={[styles.selected, motion]} />
    <View style={styles.icon}><Icon name={item.icon} size={20} color={active ? colors.onAccent : colors.ink3} />{unread > 0 ? <View style={[styles.unread, { backgroundColor: active ? colors.onAccent : colors.accentText }]} /> : null}</View>
    <Text numberOfLines={1} style={[styles.label, active && { color: colors.onAccent, fontWeight: "700" }]}>{item.title}</Text>
  </Pressy>;
}
const styles = themedStyleSheet(t => ({
  bar: { flexDirection: "row", backgroundColor: t.canvas, paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderTopWidth: 0.5, borderTopColor: t.line },
  tab: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  selected: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, borderRadius: t.radius.sm, backgroundColor: t.accent },
  icon: { alignItems: "center", justifyContent: "center" },
  unread: { position: "absolute", right: -3, top: -2, width: 5, height: 5, borderRadius: 3 },
  label: { fontSize: 12, lineHeight: 17, color: t.ink3, flexShrink: 1 },
}));
