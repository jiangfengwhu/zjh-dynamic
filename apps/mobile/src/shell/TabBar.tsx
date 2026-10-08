import { HostText as Text } from "./feed/HostText";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import { createThemedStyles, useTheme } from "../../../../packages/ui/theme";
import {
  useNotificationCount,
} from "./feed/notifications";
import { useMessageCount, useMessagesSync } from "./social/api";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";


export const SHELL_TABS = [
  { id: "feed", title: "动态", short: "动态", icon: "feed" },
  { id: "market", title: "应用市场", short: "市场", icon: "box" },
  { id: "notifications", title: "通知", short: "通知", icon: "bell" },
  { id: "mine", title: "我的", short: "我的", icon: "mine" },
] as const;
export type ShellTabId = (typeof SHELL_TABS)[number]["id"];

/** 每个 tab 的糖果色：选中时图标染色，背后浮出同色浅底。 */
function tabTone(id: ShellTabId, t: ReturnType<typeof useTheme>["colors"]) {
  switch (id) {
    case "feed": return { color: t.accent, tint: t.accentTint };
    case "market": return { color: t.orange, tint: t.orangeTint };
    case "notifications": return { color: t.orchid, tint: t.orchidTint };
    case "mine": return { color: t.cyan, tint: t.cyanTint };
  }
}

/** 悬浮导航条：五个等宽槽位，发布键恒定居中；切换只改变颜色，不改变任何尺寸与位置。 */
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
      <View style={styles.slot}>
        <Pressy
          accessibilityRole="button"
          accessibilityLabel="发布动态或制作应用"
          onPress={onCompose}
          scale={0.92}
          hitSlop={4}
          style={styles.compose}
        >
          <SymbolIcon name="plus" size={20} strokeWidth={2.6} color="#FFFFFF" />
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

  const colors = useTheme().colors;
  const tone = tabTone(item.id, colors);
  return (
    <View style={styles.slot}>
      <Pressy
        onPress={onPress}
        scale={0.92}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.title + (unread ? `，${unread}条未读通知` : "")}
        style={styles.tab}
      >
        <View style={styles.pill}>
          {active ? (
            <Animated.View
              entering={FadeIn.duration(140).reduceMotion(ReduceMotion.System)}
              style={[StyleSheet.absoluteFill, styles.pillFill, { backgroundColor: tone.tint }]}
            />
          ) : null}
          <SymbolIcon
            name={item.icon}
            size={21}
            strokeWidth={active ? 2.3 : 1.8}
            color={active ? tone.color : colors.ink3}
          />
          {unread > 0 ? <View style={styles.unread} /> : null}
        </View>
        <Text numberOfLines={1} style={[styles.label, { color: active ? tone.color : colors.ink3 }]}>{item.short}</Text>
      </Pressy>
    </View>
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
      height: 58,
      borderRadius: 22,
      paddingHorizontal: 4,
      borderWidth: t.mode === "dark" ? t.components.surfaceBorder : 0,
      borderColor: t.line,
      boxShadow: t.shadow.float,
    },
    slot: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center" },
    tab: {
      alignSelf: "stretch",
      minHeight: 52,
      paddingHorizontal: 0,
      paddingVertical: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
    },
    pill: {
      width: 44,
      height: 28,
      alignItems: "center",
      justifyContent: "center",
    },
    pillFill: { borderRadius: 14 },
    unread: {
      position: "absolute",
      right: 8,
      top: 1,
      width: 8,
      height: 8,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: t.surface,
      backgroundColor: t.orchid,
    },
    label: { fontSize: 10, lineHeight: 13, fontWeight: "700" },
    compose: {
      width: 44,
      height: 40,
      minWidth: 44,
      minHeight: 40,
      padding: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      experimental_backgroundImage: t.aurora,
      boxShadow: "0 4px 12px rgba(255,61,139,0.35)",
    },
  };
});
