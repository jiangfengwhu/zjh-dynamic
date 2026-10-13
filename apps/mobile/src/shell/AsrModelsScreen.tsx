import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { Screen } from "../../../../packages/ui/edge";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { Button } from "../../../../packages/ui/primitives/Button";
import { Icon, PageHeader, Surface } from "../../../../packages/ui/chrome";
import { createThemedStyles, useTheme } from "../../../../packages/ui/theme";
import { HostAlert } from "./HostAlert";
import { AsrDownloadButton, AsrModelProgress } from "./AsrModelControls";
import { deleteAsrModel, refreshAsrModel, useAsrModel } from "./asrModel";

export function AsrModelsScreen({ onBack }: { onBack: () => void }) {
  const styles = useStyles(), { colors } = useTheme(), state = useAsrModel(), [error, setError] = useState("");
  const refresh = () => { setError(""); void refreshAsrModel().catch(() => setError("模型状态读取失败，请重试")); };
  useEffect(() => { let active = true; void refreshAsrModel().catch(() => { if (active) setError("模型状态读取失败，请重试"); }); return () => { active = false; }; }, []);
  return <Screen style={styles.screen}><PageHeader title="语音识别" onBack={onBack} /><ScrollView contentContainerStyle={styles.content}>
    <Surface style={styles.card}><View style={styles.heading}><View style={styles.mark}><Icon name="mic" size={21} color={colors.cyan} /></View><View style={{ flex: 1, gap: 2 }}><Text style={styles.title}>中英语音识别</Text><Text style={styles.hint}>离线识别 · 自动标点 · 所有作品共用</Text></View></View>
      <Text style={styles.body}>下载一次即可使用，语音识别在本机完成。模型独立保存，不占安装包体积。</Text>
      <AsrModelProgress />
      {error ? <View style={{ gap: 8 }}><Text style={styles.error}>{error}</Text><Button label="重新读取" variant="outline" onPress={refresh} /></View> : null}
      {!state.ready ? <AsrDownloadButton /> : null}
      {state.ready || state.storedBytes > 0 || state.deleting ? <Button label={state.deleting ? "正在删除" : "删除模型"} variant="outline" intent="danger" disabled={state.deleting || state.inUse || state.downloading} onPress={() => HostAlert.alert("删除语音模型？", "删除后释放模型占用的空间；下次语音录入需要重新下载。", [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive", onPress: () => void deleteAsrModel() }])} /> : null}
      {state.inUse ? <Text style={styles.hint}>正在语音录入，结束后可删除模型。</Text> : null}
    </Surface>
  </ScrollView></Screen>;
}
const useStyles = createThemedStyles(t => ({ screen: { flex: 1, backgroundColor: t.canvas }, content: { padding: 16 }, card: { padding: 16, gap: 14, borderRadius: t.radius.xl }, heading: { flexDirection: "row", alignItems: "center", gap: 10 }, mark: { width: 38, height: 38, borderRadius: 12, backgroundColor: t.cyanTint, alignItems: "center", justifyContent: "center" }, title: { color: t.ink1, fontSize: 16, lineHeight: 22, fontWeight: "700" }, hint: { color: t.ink3, fontSize: 12, lineHeight: 18 }, body: { color: t.ink2, fontSize: 13, lineHeight: 20 }, error: { color: t.redText, fontSize: 13, lineHeight: 19 } }));
