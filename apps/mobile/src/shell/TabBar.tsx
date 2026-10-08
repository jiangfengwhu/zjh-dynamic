import { HostText as Text } from "./feed/HostText";
import { View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";
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

const springLayout = LinearTransition.springify().damping(22).stiffness(260).reduceMotion(ReduceMotion.System);

/** 悬浮导航坞：两种模式下都是深色玻璃；当前页展开为白色胶囊，其余只留图标。 */
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
      <Animated.View layout={springLayout} style={styles.composeSlot}>
        <Pressy
          accessibilityRole="button"
          accessibilityLabel="发布动态或制作应用"
          onPress={onCompose}
          scale={0.88}
          style={styles.compose}
        >
          <SymbolIcon name="plus" size={22} strokeWidth={2.6} color="#FFFFFF" />
        </Pressy>
      </Animated.View>
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
  return (
    <Animated.View layout={springLayout} style={[styles.slot, active && styles.slotActive]}>
      <Pressy
        onPress={onPress}
        scale={0.9}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.title + (unread ? `，${unread}条未读通知` : "")}
        style={styles.tab}
      >
        <Animated.View layout={springLayout} style={[styles.pill, active && styles.pillActive]}>
          <View>
            <SymbolIcon
              name={item.icon}
              size={21}
              strokeWidth={active ? 2.2 : 1.8}
              color={active ? colors.onDockActive : colors.onDockMuted}
            />
            {unread > 0 ? <View style={[styles.unread, active && { borderColor: colors.dockActive }]} /> : null}
          </View>
          {active ? (
            <Animated.View entering={FadeIn.duration(160).delay(60).reduceMotion(ReduceMotion.System)} exiting={FadeOut.duration(80)}>
              <Text numberOfLines={1} style={styles.label}>{item.short}</Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      </Pressy>
    </Animated.View>
  );
}
const useStyles = createThemedStyles((base) => {
  const t = base;
  return {
    bar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.dock,
      marginHorizontal: 20,
      height: 64,
      borderRadius: 32,
      paddingHorizontal: 8,
      gap: 2,
      borderWidth: t.components.surfaceBorder,
      borderColor: t.dockLine,
      boxShadow: t.shadow.float,
    },
    slot: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
    slotActive: { flexGrow: 1.9 },
    tab: {
      minHeight: 48,
      paddingHorizontal: 0,
      paddingVertical: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    pill: {
      height: 44,
      minWidth: 44,
      paddingHorizontal: 12,
      borderRadius: 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
    },
    pillActive: { backgroundColor: t.dockActive, paddingHorizontal: 16 },
    unread: {
      position: "absolute",
      right: -3,
      top: -2,
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: t.dock,
      backgroundColor: t.orchid,
    },
    label: { fontSize: 13, lineHeight: 17, fontWeight: "700", letterSpacing: -0.1, color: t.onDockActive },
    composeSlot: { paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
    compose: {
      width: 48,
      height: 48,
      minWidth: 48,
      minHeight: 48,
      padding: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      experimental_backgroundImage: t.aurora,
      boxShadow: "0 6px 18px rgba(115,87,255,0.45)",
    },
  };
});
