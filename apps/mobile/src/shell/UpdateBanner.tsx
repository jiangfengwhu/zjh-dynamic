import { Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Pressy, Surface } from "../../../../packages/ui/chrome";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import type { PendingPackage } from "./packageUpdates";

type Props = {
  items: PendingPackage[];
  busy: boolean;
  completed: boolean;
  onNow: () => void;
  onLater: () => void;
};

const layerTitle: Record<string, string> = {
  vendor: "第三方库",
  app: "应用代码",
  release: "一整套",
};

export function UpdateBanner({ items, busy, completed, onNow, onLater }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const names = items.map(titleOf);
  const shown = names.slice(0, 3).join("、");
  const extra = names.length > 3 ? ` 等 ${names.length} 个` : "";
  return (
    <Animated.View
      style={[styles.wrap, { top: insets.top + 8 }]}
    >
      <Surface tone="raised" radius={colors.radius.xl} lifted style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Icon name="box" size={28} color={colors.accentText} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{completed ? "你的新作品送到了" : "伙伴们带来了新内容"}</Text>
            <Text style={styles.detail}>
              {completed
                ? "加载这次的作品，即可体验。加载时会刷新应用。"
                : "新内容已经备好。加载时会刷新应用，也可以留到下次见面。"}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressy accessibilityRole="button" disabled={busy} onPress={onLater} style={styles.later}>
            <Text style={styles.laterText}>稍后体验</Text>
          </Pressy>
          <Pressy accessibilityRole="button" disabled={busy} onPress={onNow} style={[styles.now, busy && styles.nowBusy]}>
            <Text style={styles.nowText}>{busy ? "正在迎接新作品" : "加载新作品"}</Text>
          </Pressy>
        </View>
      </Surface>
    </Animated.View>
  );
}

function titleOf(item: PendingPackage): string {
  return layerTitle[item.id] ?? item.id;
}

const styles = themedStyleSheet((t) => ({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 30,
  },
  card: {
    padding: 16,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: t.accentSoft,
    backgroundColor: t.surface,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: t.serif,
    fontSize: 17,
    fontWeight: "700",
    color: t.ink1,
  },
  detail: {
    fontSize: 13,
    lineHeight: 19,
    color: t.ink2,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  later: {
    height: 40,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.md,
  },
  laterText: {
    fontSize: 14,
    fontWeight: "600",
    color: t.ink2,
  },
  now: {
    height: 40,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.md,
    backgroundColor: t.accent,
  },
  nowBusy: {
    opacity: 0.6,
  },
  nowText: {
    fontSize: 14,
    fontWeight: "700",
    color: t.onAccent,
  },
}));
