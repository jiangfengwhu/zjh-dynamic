import { Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressy, Surface } from "../../../components/chrome";
import { JollyVideoPlayer } from "../../../components/jolly";
import { themedStyleSheet, useTheme } from "../../../components/theme";
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
      entering={FadeInUp.duration(420)}
      exiting={FadeOutUp.duration(220)}
      style={[styles.wrap, { top: insets.top + 8 }]}
    >
      <Surface tone="raised" radius={colors.radius.xl} lifted style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <JollyVideoPlayer state="level_up" width={60} height={60} borderRadius={20} resizeMode="cover" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{completed ? "需求完成了" : "有新内容可以加载"}</Text>
            <Text style={styles.detail}>
              {completed
                ? `${shown}${extra} 已经准备好。现在加载会带上这次的结果，留到下次启动也可以。`
                : `${shown}${extra} 已下载到本机。现在加载会刷新应用，留到下次启动也可以。`}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressy accessibilityRole="button" disabled={busy} onPress={onLater} style={styles.later}>
            <Text style={styles.laterText}>下次再说</Text>
          </Pressy>
          <Pressy accessibilityRole="button" disabled={busy} onPress={onNow} style={[styles.now, busy && styles.nowBusy]}>
            <Text style={styles.nowText}>{busy ? "正在加载" : "现在加载"}</Text>
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
