import { useEffect } from "react";
import { Pressable, View } from "react-native";
import { EdgeModal } from "../../../../packages/ui/edge";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { Button } from "../../../../packages/ui/primitives/Button";
import { Surface } from "../../../../packages/ui/chrome";
import { createThemedStyles } from "../../../../packages/ui/theme";
import { setSpeechModelPreparation } from "../../../../packages/platform/src/speechModel";
import { AsrDownloadButton, AsrModelProgress } from "./AsrModelControls";
import { finishModelPrompt, modelPromptOpen, prepareAsrModel, useAsrModel, useAsrModelPrompt, watchAsrModel } from "./asrModel";
import { formatBytes } from "./packages";

export function AsrModelDownloadHost() {
  const styles = useStyles(), state = useAsrModel(); useAsrModelPrompt();
  useEffect(() => { const clearHandler = setSpeechModelPreparation(prepareAsrModel), clearEvents = watchAsrModel(); return () => { clearHandler(); clearEvents(); finishModelPrompt(false); }; }, []);
  if (!modelPromptOpen()) return null;
  const close = () => finishModelPrompt(false);
  return <EdgeModal visible transparent animationType="fade" onRequestClose={close}>
    <View style={styles.overlay}><Pressable accessibilityLabel="关闭模型下载提示" onPress={close} style={styles.backdrop} /><Surface style={styles.dialog}>
      <Text accessibilityRole="header" style={styles.title}>{state.downloading ? "下载语音模型" : "需要下载语音模型"}</Text>
      <Text style={styles.body}>首次语音录入需下载约 {formatBytes(state.total)} 的中英模型。下载后可离线识别，所有作品共用；可在设置中管理。</Text>
      <AsrModelProgress />
      <View style={styles.actions}><Button label={state.downloading ? "后台下载" : "暂不下载"} variant="ghost" onPress={close} /><AsrDownloadButton /></View>
    </Surface></View>
  </EdgeModal>;
}
const useStyles = createThemedStyles(t => ({ overlay: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center" }, backdrop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: t.dock, opacity: .55 }, dialog: { width: "100%", maxWidth: 380, borderRadius: t.radius.xl, padding: 18, gap: 14, boxShadow: t.shadow.modal }, title: { color: t.ink1, fontSize: 17, lineHeight: 24, fontWeight: "700" }, body: { color: t.ink2, fontSize: 13, lineHeight: 20 }, actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 } }));
