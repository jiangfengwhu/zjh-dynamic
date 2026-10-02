import { useEffect, useState } from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { GiltLine, Icon, Pressy } from "../../../../packages/ui/chrome";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { useNotificationCount, useNotificationSync } from "./feed/notifications";

export const SHELL_TABS = [
  { id: "feed", title: "动态", icon: "feed" },
  { id: "market", title: "应用市场", icon: "box" },
  { id: "mine", title: "我的", icon: "mine" },
] as const;

export type ShellTabId = (typeof SHELL_TABS)[number]["id"];

const PILL_WIDTH = 60;
const SPRING = { damping: 19, stiffness: 230, mass: 0.9 } as const;

export function TabBar({
  activeId,
  onChange,
}: {
  activeId: string;
  onChange: (id: ShellTabId) => void;
}) {
  const { colors } = useTheme();
  const notificationCount = useNotificationCount(); useNotificationSync();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, SHELL_TABS.findIndex((item) => item.id === activeId));
  const slot = width / SHELL_TABS.length;
  const x = useSharedValue(0);
  const placed = useSharedValue(false);

  useEffect(() => {
    if (!slot) return;
    const target = index * slot + (slot - PILL_WIDTH) / 2;
    if (!placed.value) {
      x.value = target;
      placed.value = true;
      return;
    }
    x.value = withSpring(target, SPRING);
  }, [index, slot, x, placed]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View style={styles.bar} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
      <GiltLine style={styles.edge} />
      {slot ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { backgroundColor: colors.accentTint, borderColor: colors.accentSoft }, pill]}
        />
      ) : null}
      {SHELL_TABS.map((item) => (
        <TabButton key={item.id} item={item} active={item.id === activeId} unread={item.id === "feed" ? notificationCount : 0} onPress={() => onChange(item.id)} />
      ))}
    </View>
  );
}

function TabButton({
  item,
  active,
  onPress,
  unread,
}: {
  item: (typeof SHELL_TABS)[number];
  active: boolean;
  onPress: () => void;
  unread: number;
}) {
  const { colors } = useTheme();
  const level = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    level.value = withTiming(active ? 1 : 0, { duration: 240 });
  }, [active, level]);

  const rest = useAnimatedStyle(() => ({ opacity: 1 - level.value }));
  const lit = useAnimatedStyle(() => ({
    opacity: level.value,
    transform: [{ translateY: interpolate(level.value, [0, 1], [3, 0]) }, { scale: interpolate(level.value, [0, 1], [0.86, 1]) }],
  }));

  return (
    <Pressy
      accessibilityRole="tab"
      accessibilityLabel={`${item.title}${unread ? `，${unread}条未读通知` : ""}`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      scale={0.92}
      style={styles.tab}
    >
      <View style={styles.iconBox}>
        {unread > 0 ? <View style={{ position: "absolute", top: -2, right: -3, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent, zIndex: 2 }} /> : null}
        <Animated.View style={[styles.layer, rest]}>
          <Icon name={item.icon} size={23} color={colors.ink3} />
        </Animated.View>
        <Animated.View style={[styles.layer, lit]}>
          <Icon name={item.icon} size={23} color={colors.accentText} strokeWidth={1.9} />
        </Animated.View>
      </View>
      <Text style={[styles.label, active && styles.labelActive]}>{item.title}</Text>
    </Pressy>
  );
}

const styles = themedStyleSheet((t) => ({
  bar: {
    flexDirection: "row",
    alignItems: "stretch",
    paddingTop: 6,
    paddingBottom: 4,
    backgroundColor: t.canvas,
  },
  edge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  pill: {
    position: "absolute",
    top: 9,
    left: 0,
    width: PILL_WIDTH,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 3,
    paddingTop: 3,
  },
  iconBox: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  layer: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    color: t.ink3,
    letterSpacing: 0.2,
  },
  labelActive: {
    color: t.accentText,
    fontWeight: "700",
  },
}));
