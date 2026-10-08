import { Text } from "../../../../packages/ui/primitives/Typography";
import type { ApkProgress } from "./apkUpdates";
import { View } from "react-native";
import Animated, { FadeInUp, FadeOutUp, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Pressy, Surface } from "../../../../packages/ui/chrome";
import { createThemedStyles, useTheme } from "../../../../packages/ui/theme";
import type { PendingPackage } from "./packageUpdates";

type Props = {
  items: PendingPackage[];
  busy: boolean;
  completed: boolean;
  error?: string;
  apkProgress?: ApkProgress;
  onNow: () => void;
  onLater: () => void;
};

export function UpdateBanner({ items, busy, completed, error, apkProgress: reportedProgress, onNow, onLater }: Props) {
  const styles = useStyles();

  const { colors } = useTheme();
  const apk = items.find(item => item.kind === "apk");
  const insets = useSafeAreaInsets();
  const apkProgress = reportedProgress?.sha256 === apk?.sha256 ? reportedProgress : undefined;
  const percent = apkProgress ? Math.min(100, Math.floor(apkProgress.received / apkProgress.total * 100)) : 0;
  const apkAction = busy ? apkProgress?.phase === "downloading" ? `下载中 ${percent}%` : apkProgress?.phase === "verifying" ? "校验安装包…" : "准备安装…" : error ? "重试更新" : apkProgress?.phase === "ready" ? "安装更新" : "下载并安装";
  return (
    <Animated.View
      entering={FadeInUp.duration(220).reduceMotion(ReduceMotion.System)}
      exiting={FadeOutUp.duration(160).reduceMotion(ReduceMotion.System)}
      style={[styles.wrap, { top: insets.top + 8 }]}
    >
      <Surface tone="raised" radius={colors.radius.xl} lifted style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Icon name="box" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{apk ? `新版本 ${apk.versionName} 可更新` : completed ? "作品已准备好" : "有可用更新"}</Text>
            <Text style={styles.detail}>
              {apk ? apkProgress?.phase === "ready" ? "安装包已下载，按系统提示安装；取消后可再次点击安装。" : "在应用内下载并安装更新，保留本机数据。" : completed
                ? "加载这次的作品，即可体验。加载时会刷新应用。"
                : `${items.length} 项更新已备好，加载后会刷新应用。`}
            </Text>
          </View>
        </View>
        {apk ? <View accessibilityRole="progressbar" accessibilityLabel="安装包下载进度" accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ height: 4, borderRadius: 2, backgroundColor: busy ? colors.surfaceRaised : "transparent", overflow: "hidden" }}><View style={{ height: 4, width: `${percent}%`, borderRadius: 2, experimental_backgroundImage: busy ? colors.aurora : undefined }} /></View> : null}
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        <View style={styles.actions}>
          <Pressy accessibilityRole="button" disabled={busy} onPress={onLater} style={styles.later}>
            <Text style={styles.laterText}>稍后体验</Text>
          </Pressy>
          <Pressy accessibilityRole="button" disabled={busy} onPress={onNow} style={[styles.now, busy && styles.nowBusy]}>
            <Text style={styles.nowText}>{apk ? apkAction : busy ? "正在加载更新…" : error ? "重试更新" : "加载更新"}</Text>
          </Pressy>
        </View>
      </Surface>
    </Animated.View>
  );
}

const useStyles = createThemedStyles((t) => ({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 30,
  },
  card: {
    padding: 18,
    gap: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    experimental_backgroundImage: t.aurora,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: t.serif,
    ...t.type.headline,
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
    minHeight: 44,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: t.surfaceRaised,
  },
  laterText: {
    fontSize: 14,
    fontWeight: "700",
    color: t.ink1,
  },
  now: {
    minHeight: 44,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
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
