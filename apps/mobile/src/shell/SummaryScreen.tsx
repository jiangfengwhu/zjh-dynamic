import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView as ScrollView } from "react-native-keyboard-controller";
import { useIsFocused } from "@react-navigation/native";
import { shellProviders } from "../../../../packages/platform/src/shellCapabilities";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { retryFeedSummary, subscribeSummaryStatus, type SummaryStatus } from "./feed/summary";
import Toast from "react-native-toast-message";
import { FormField as TextInput } from "./FormField";
import { PageHeader, Pressy, SectionTitle, Surface } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { readSummaryEvery, subscribeSummaryEvery, SUMMARY_CHOICES, writeSummaryEvery } from "../../../../packages/ui/feed";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";

type Props = {
  onBack: () => void;
};

export function SummaryScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const [summaryEvery, setSummaryEvery] = useState(() => readSummaryEvery());
  const [customMinutes, setCustomMinutes] = useState("");
  const focused = useIsFocused();
  const [engine, setEngine] = useState("正在读取 AI 引擎…");
  const [status, setStatus] = useState<SummaryStatus>({ running: false });
  useEffect(() => subscribeSummaryStatus(setStatus), []);
  useEffect(() => { if (!focused) return; let live = true;
    void shellProviders().then(result => { if (live) setEngine(result.ok ? result.items?.find(item => item.isDefault)?.name || result.items?.[0]?.name || "尚未配置 AI 引擎" : "AI 引擎读取失败，请重新配置或重试"); }, () => { if (live) setEngine("AI 引擎读取失败，请重试"); });
    return () => { live = false; };
  }, [focused]);
  useEffect(() => subscribeSummaryEvery(setSummaryEvery), []);
  const custom = summaryEvery > 0 && !SUMMARY_CHOICES.some((choice) => choice.ms === summaryEvery);

  return (
    <Screen style={styles.screen}>
      <PageHeader title="动态小结" caption="到点后按变化写一条动态" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SectionTitle>运行状态</SectionTitle>
        <Surface style={styles.panel}>
          <Text style={styles.hint}>到点后，用默认的 AI 引擎，按每个应用这段时间的变化写一条动态。</Text>
          <Text style={styles.hint}>默认引擎：{engine}</Text>
          <Pressy accessibilityRole="button" onPress={() => applicationContext("jolly").ai.openSettings()}><Text style={{ color: colors.accentText }}>配置 AI 引擎</Text></Pressy>
          <Text accessibilityLiveRegion="polite" style={styles.hint}>{status.running ? "正在生成小结…" : status.error ? `小结未完成：${status.error}。变更已保留，重试前请检查引擎。` : status.completedAt ? `最近成功：${new Date(status.completedAt).toLocaleString()}` : "尚未生成小结"}</Text>
          <Pressy accessibilityRole="button" disabled={status.running || summaryEvery <= 0} onPress={() => void retryFeedSummary()} style={styles.run}><Text style={{ color: colors.onAccent, fontWeight: "700" }}>{status.error ? "重试小结" : "立即整理变更"}</Text></Pressy>
          </Surface>
        <SectionTitle>整理频率</SectionTitle>
        <Surface style={styles.panel}>
          <View style={styles.choices}>
            {SUMMARY_CHOICES.map((choice) => {
              const active = summaryEvery === choice.ms;
              return (
                <Pressy
                  key={choice.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => writeSummaryEvery(choice.ms)}
                  scale={0.94}
                  style={[styles.choice, active && styles.choiceActive]}
                >
                  <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{choice.label}</Text>
                </Pressy>
              );
            })}
          </View>
          <View style={styles.customRow}>
            <TextInput
              accessibilityLabel="自定义小结间隔（分钟）"
              value={customMinutes}
              onChangeText={setCustomMinutes}
              keyboardType="number-pad"
              placeholder={custom ? `当前 ${Math.round(summaryEvery / 60000)} 分钟` : "自定义分钟数"}
              placeholderTextColor={colors.ink3}
              style={styles.input}
            />
            <Pressy
              accessibilityRole="button"
              onPress={() => {
                const minutes = Number(customMinutes.trim());
                if (!Number.isSafeInteger(minutes) || minutes < 1 || !Number.isSafeInteger(minutes * 60 * 1000)) { Toast.show({ type: "error", text1: "请输入有效的正整数分钟数" }); return; }
                writeSummaryEvery(minutes * 60 * 1000);
                setCustomMinutes("");
              }}
              style={styles.apply}
            >
              <Text style={styles.applyText}>使用</Text>
            </Pressy>
          </View>
        </Surface>
      </ScrollView>
    </Screen>
  );
}

const styles = themedStyleSheet((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 8,
  },
  panel: {
    padding: 12,
    gap: 8,
    borderRadius: t.radius.xl,
  },
  hint: {
    fontSize: 13,
    lineHeight: 19,
    color: t.ink2,
  },
  run: { backgroundColor: t.accent, borderRadius: t.radius.sm, alignItems: "center" },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choice: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: t.radius.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.lineStrong,
    backgroundColor: t.inset,
  },
  choiceActive: {
    borderColor: t.accentSoft,
    backgroundColor: t.accentTint,
  },
  choiceText: {
    fontSize: 13.5,
    color: t.ink2,
  },
  choiceTextActive: {
    color: t.accentText,
    fontWeight: "700",
  },
  customRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.lineStrong,
    backgroundColor: t.field,
    color: t.ink1,
    fontSize: 14.5,
  },
  apply: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: t.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.accent,
  },
  applyText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: t.onAccent,
  },
}));
