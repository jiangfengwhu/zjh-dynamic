import { ScrollView, Text, View } from "react-native";
import { Icon, PageHeader, Surface } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme, type ThemeMode } from "../../../../packages/ui/theme";
import { CompactTabs } from "./CompactTabs";

type Props = { mode: ThemeMode; onMode: (mode: ThemeMode) => void; onBack: () => void };
const options = [{ id: "dark", label: "深色" }, { id: "light", label: "浅色" }] as const;

export function AppearanceScreen({ mode, onMode, onBack }: Props) {
  const { colors } = useTheme();
  return <Screen style={styles.screen}>
    <PageHeader title="外观" caption="石墨、银灰与酸橙色" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content}>
      <CompactTabs value={mode} options={options} onChange={onMode} />
      <Surface style={styles.preview}>
        <View style={styles.previewHeading}><Icon name={mode === "dark" ? "moon" : "sun"} color={colors.accentText} size={24} /><View style={styles.copy}><Text accessibilityRole="header" style={styles.title}>{mode === "dark" ? "石墨深色" : "冷白浅色"}</Text><Text style={styles.hint}>当前配色即时应用到所有页面</Text></View><Icon name="check" size={18} color={colors.accentText} /></View>
        <View style={styles.palette}>{[colors.canvas, colors.surface, colors.surfaceRaised, colors.ink1, colors.accent].map((color, index) => <View key={index} accessibilityLabel={["画布", "内容表面", "浮层", "正文", "强调色"][index]} style={[styles.swatch, { backgroundColor: color }]} />)}</View>
        <Text style={styles.sampleTitle}>清晰的层级，紧凑的节奏</Text>
        <Text style={styles.sampleBody}>用边界和字重区分内容，给动态、作品与操作留出恰好的空间。</Text>
        <View style={styles.sampleRow}><Text style={styles.hint}>正文与次要信息</Text><Text style={styles.link}>操作强调</Text></View>
      </Surface>
      <Text style={styles.hint}>动效遵循手机的「减少动态效果」设置。</Text>
    </ScrollView>
  </Screen>;
}
const styles = themedStyleSheet(t => ({
  screen: { backgroundColor: t.canvas }, content: { padding: 16, gap: 12 },
  preview: { padding: 16, gap: 12 }, previewHeading: { flexDirection: "row", alignItems: "center", gap: 12 }, copy: { flex: 1, gap: 2 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: "700", color: t.ink1 }, hint: { fontSize: 12, lineHeight: 18, color: t.ink3 },
  palette: { flexDirection: "row", gap: 4 }, swatch: { flex: 1, height: 36, borderRadius: t.radius.xs, borderWidth: 0.5, borderColor: t.lineStrong },
  sampleTitle: { fontSize: 21, lineHeight: 28, letterSpacing: -0.5, color: t.ink1, fontWeight: "700" }, sampleBody: { fontSize: 14, lineHeight: 21, color: t.ink2 },
  sampleRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, borderTopWidth: 0.5, borderTopColor: t.line, paddingTop: 12 }, link: { color: t.accentText, fontSize: 12, fontWeight: "600" },
}));
