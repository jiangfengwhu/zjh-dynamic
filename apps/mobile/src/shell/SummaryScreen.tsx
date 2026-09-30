import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PageHeader, Pressy, Surface } from "../../../../packages/ui/chrome";
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
  useEffect(() => subscribeSummaryEvery(setSummaryEvery), []);
  const custom = summaryEvery > 0 && !SUMMARY_CHOICES.some((choice) => choice.ms === summaryEvery);

  return (
    <Screen style={styles.screen}>
      <PageHeader title="动态小结" caption="到点后按变化写一条动态" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Surface style={styles.panel}>
          <Text style={styles.hint}>到点后，用默认的 AI 引擎，按每个应用这段时间的变化写一条动态。</Text>
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
                if (!Number.isFinite(minutes) || minutes < 1) return;
                writeSummaryEvery(Math.round(minutes) * 60 * 1000);
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
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 36,
  },
  panel: {
    padding: 16,
    gap: 14,
    borderRadius: t.radius.xl,
  },
  hint: {
    fontSize: 13.5,
    lineHeight: 20,
    color: t.ink2,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  choice: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
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
    paddingHorizontal: 22,
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
