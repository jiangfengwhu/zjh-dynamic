import { ActivityIndicator, View } from "react-native";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { Button } from "../../../../packages/ui/primitives/Button";
import { createThemedStyles, useTheme } from "../../../../packages/ui/theme";
import { cancelAsrModel, downloadAsrModel, useAsrModel } from "./asrModel";
import { formatBytes } from "./packages";

export function AsrModelProgress() {
  const state = useAsrModel(), styles = useStyles(), { colors } = useTheme();
  const fraction = state.total > 0 ? Math.min(1, state.received / state.total) : 0;
  return <View style={styles.progress}>
    <View style={styles.spread}><Text style={styles.hint}>{state.cancelling ? "正在取消下载…" : state.deleting ? "正在删除模型…" : state.downloading ? "正在下载模型" : state.ready ? "已下载 · 可离线使用" : state.loaded ? "尚未下载" : "读取模型信息…"}</Text>{state.downloading ? <Text style={styles.hint}>{Math.floor(fraction * 100)}%</Text> : null}</View>
    {state.downloading ? <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.floor(fraction * 100) }} style={styles.track}><View style={[styles.fill, { width: `${fraction * 100}%` }]} /></View> : null}
    <View style={styles.spread}><Text style={styles.hint}>{state.downloading ? `${formatBytes(state.received)} / ${formatBytes(state.total)}` : state.loaded ? `模型大小 ${formatBytes(state.total)} · 已保存 ${formatBytes(state.storedBytes)}` : "首次使用需联网下载"}</Text>{state.deleting || state.cancelling ? <ActivityIndicator size="small" color={colors.accent} /> : null}</View>
    {state.error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{state.error}</Text> : null}
  </View>;
}
export function AsrDownloadButton() {
  const state = useAsrModel();
  return state.downloading ? <Button label={state.cancelling ? "取消中" : "取消下载"} variant="outline" disabled={state.cancelling} onPress={() => void cancelAsrModel()} /> : <Button label={state.error || state.storedBytes > 0 ? "继续下载" : "下载模型"} disabled={!state.loaded || state.deleting || state.ready} onPress={() => void downloadAsrModel()} />;
}
const useStyles = createThemedStyles(t => ({
  progress: { gap: 8 }, spread: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  hint: { color: t.ink3, fontSize: 12, lineHeight: 18 }, error: { color: t.redText, fontSize: 13, lineHeight: 19 },
  track: { height: 5, backgroundColor: t.surfaceRaised, borderRadius: 3, overflow: "hidden" }, fill: { height: 5, borderRadius: 3, backgroundColor: t.accent },
}));
