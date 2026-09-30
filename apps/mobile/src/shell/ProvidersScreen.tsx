import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Icon, PageHeader, Pressy, SectionTitle, Surface } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { Input } from "../../../../packages/ui/shadcn/Input";
import { Switch } from "../../../../packages/ui/shadcn/Switch";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import {
  shellDeleteProvider,
  shellProviders,
  shellSaveProvider,
  type AiProvider,
} from "../../../../packages/platform/src/shellCapabilities";

type Props = {
  onBack: () => void;
};

const empty = {
  id: "",
  name: "agnes",
  baseUrl: "https://api.agnes-ai.cn/v1",
  apiKey: "",
  model: "agnes-2.5-flash",
  isDefault: false,
};

export function ProvidersScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const [items, setItems] = useState<AiProvider[]>([]);
  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState("");

  async function reload() {
    const result = await shellProviders();
    setItems(result.items ?? []);
  }

  useEffect(() => {
    void reload().catch((reason) => console.log("providers unreadable", reason));
  }, []);

  async function save() {
    setError("");
    const result = await shellSaveProvider({
      id: draft.id || undefined,
      name: draft.name.trim() || draft.model.trim() || "未命名",
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey,
      model: draft.model.trim(),
      isDefault: draft.isDefault || items.length === 0,
    });
    if (!result.ok) {
      setError(result.error ?? "保存失败");
      return;
    }
    setDraft(empty);
    await reload();
  }

  return (
    <Screen style={styles.screen}>
      <PageHeader
        title="AI 引擎"
        caption={items.length > 0 ? `已接入 ${items.length} 个` : "接入一个模型，小结和创作都会用到"}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {items.length > 0 ? (
          <View style={styles.block}>
            <SectionTitle>已接入</SectionTitle>
            {items.map((item) => {
              const selected = draft.id === item.id;
              return (
                <Animated.View key={item.id} entering={FadeIn.duration(260)} layout={LinearTransition.duration(220)}>
                  <Surface
                    tone={selected ? "raised" : "base"}
                    style={[
                      styles.card,
                      item.isDefault && { borderColor: colors.accentSoft },
                      selected && { borderColor: colors.accent },
                    ]}
                  >
                    <Pressy
                      accessibilityRole="button"
                      accessibilityLabel={`编辑${item.name}`}
                      scale={0.985}
                      style={styles.main}
                      onPress={() => setDraft({ ...item, apiKey: "" })}
                    >
                      <View style={styles.titleRow}>
                        <Text style={styles.name} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.isDefault ? (
                          <View style={[styles.badge, { backgroundColor: colors.accentTint }]}>
                            <Text style={[styles.badgeText, { color: colors.accentText }]}>默认</Text>
                          </View>
                        ) : null}
                        {selected ? (
                          <View style={[styles.badge, { backgroundColor: colors.orchidTint }]}>
                            <Text style={[styles.badgeText, { color: colors.orchidText }]}>编辑中</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={styles.meta} numberOfLines={1}>
                        {item.model}，{item.baseUrl}
                      </Text>
                    </Pressy>
                    <Pressy
                      accessibilityRole="button"
                      accessibilityLabel={`删除${item.name}`}
                      hitSlop={8}
                      scale={0.9}
                      onPress={() => {
                        void shellDeleteProvider(item.id).then(reload);
                      }}
                      style={styles.remove}
                    >
                      <Icon name="close" size={16} color={colors.redText} strokeWidth={2} />
                    </Pressy>
                  </Surface>
                </Animated.View>
              );
            })}
          </View>
        ) : null}

        <SectionTitle>{draft.id ? "编辑引擎" : "添加引擎"}</SectionTitle>
        <Surface tone="raised" radius={colors.radius.xl} style={styles.form}>
          {draft.id ? (
            <Pressy accessibilityRole="button" onPress={() => setDraft(empty)} scale={0.95} style={styles.reset}>
              <Icon name="plus" size={14} color={colors.accentText} strokeWidth={2} />
              <Text style={styles.resetText}>改为新增</Text>
            </Pressy>
          ) : null}

          <Input
            label="名称"
            value={draft.name}
            placeholder="例如：OpenAI / DeepSeek / Grok"
            onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
          />
          <Input
            label="接口地址"
            value={draft.baseUrl}
            placeholder="https://api.openai.com/v1"
            onChangeText={(baseUrl) => setDraft((current) => ({ ...current, baseUrl }))}
            autoCapitalize="none"
          />
          <Input
            label="模型"
            value={draft.model}
            placeholder="例如：gpt-4o / grok-4.7-high"
            onChangeText={(model) => setDraft((current) => ({ ...current, model }))}
            autoCapitalize="none"
          />
          <Input
            label={draft.id ? "API Key（留空则不修改）" : "API Key"}
            value={draft.apiKey}
            placeholder="sk-..."
            onChangeText={(apiKey) => setDraft((current) => ({ ...current, apiKey }))}
            secureTextEntry
            autoCapitalize="none"
          />

          <View style={styles.defaultRow}>
            <View style={styles.defaultCopy}>
              <Text style={styles.defaultLabel}>设为默认引擎</Text>
              <Text style={styles.defaultHint}>创作和动态小结默认使用它</Text>
            </View>
            <Switch checked={draft.isDefault} onCheckedChange={(isDefault) => setDraft((current) => ({ ...current, isDefault }))} />
          </View>

          {error ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.errorRow}>
              <Icon name="alert" size={16} color={colors.redText} />
              <Text style={styles.error}>{error}</Text>
            </Animated.View>
          ) : null}

          <Pressy accessibilityRole="button" onPress={() => void save()} style={styles.save}>
            <Text style={styles.saveLabel}>{draft.id ? "更新引擎" : "保存并接入"}</Text>
          </Pressy>
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
    paddingTop: 4,
    paddingBottom: 36,
    gap: 12,
  },
  block: {
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 8,
    borderRadius: t.radius.xl,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingVertical: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontFamily: t.serif,
    fontSize: 17,
    fontWeight: "700",
    color: t.ink1,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  meta: {
    fontFamily: t.mono,
    fontSize: 11.5,
    color: t.ink3,
  },
  remove: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.redTint,
  },
  form: {
    padding: 18,
    gap: 14,
  },
  reset: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  resetText: {
    fontSize: 13,
    fontWeight: "600",
    color: t.accentText,
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: t.radius.md,
    backgroundColor: t.inset,
  },
  defaultCopy: {
    flex: 1,
    gap: 2,
  },
  defaultLabel: {
    fontSize: 14.5,
    fontWeight: "600",
    color: t.ink1,
  },
  defaultHint: {
    fontSize: 12,
    color: t.ink3,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  error: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: t.redText,
  },
  save: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.lg,
    backgroundColor: t.accent,
  },
  saveLabel: {
    fontSize: 15.5,
    fontWeight: "700",
    color: t.onAccent,
  },
}));
