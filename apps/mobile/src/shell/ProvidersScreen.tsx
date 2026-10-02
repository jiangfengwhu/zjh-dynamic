import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView as ScrollView } from "react-native-keyboard-controller";
import { useDiscardChanges, confirmDiscard } from "./useDiscardChanges";
import Animated from "react-native-reanimated";
import Toast from "react-native-toast-message";
import { Icon, PageHeader, Pressy, SectionTitle, Surface } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { Input } from "../../../../packages/ui/shadcn/Input";
import { Switch } from "../../../../packages/ui/shadcn/Switch";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import {
  shellDeleteProvider,
  shellProviders,
  shellSaveProvider,
  shellComplete,
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
  const [baseline, setBaseline] = useState(empty);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useDiscardChanges(dirty);
  function selectDraft(next: typeof empty) { const apply = () => { setDraft(next); setBaseline(next); }; if (dirty) confirmDiscard(apply); else apply(); }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const working = useRef(false); const alive = useRef(true);
  function fail(reason: unknown) {
    if (!alive.current) return;
    const message = reason instanceof Error ? reason.message : "操作未完成，请重试";
    setError(message); Toast.show({ type: "error", text1: "AI 引擎操作未完成", text2: message });
  }

  async function reload() {
    const result = await shellProviders();
    if (!result.ok) throw new Error("无法读取 AI 引擎，请重试");
    if (alive.current) setItems(result.items ?? []);
  }

  useEffect(() => {
    alive.current = true;
    working.current = true; setBusy(true);
    void reload().catch(fail).finally(() => { working.current = false; if (alive.current) setBusy(false); });
    return () => { alive.current = false; };
  }, []);

  async function save() {
    if (working.current) return;
    working.current = true; setBusy(true);
    setError("");
    try {
    const result = await shellSaveProvider({
      id: draft.id || undefined,
      name: draft.name.trim() || draft.model.trim() || "未命名",
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey,
      model: draft.model.trim(),
      isDefault: draft.isDefault || items.length === 0,
    });
    if (!result.ok) {
      throw new Error(result.error ?? "保存失败");
    }
    if (alive.current) { setDraft(empty); setBaseline(empty); }
    await reload();
    if (alive.current) Toast.show({ type: "success", text1: "AI 引擎已保存" });
    } catch (reason) { fail(reason); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }

  async function verify(item: AiProvider) {
    if (working.current) return;
    working.current = true; setBusy(true); setError("");
    try {
      const result = await shellComplete({ providerId: item.id, messages: [{ role: "user", content: "请只回复 OK，用于连接验证。" }] });
      if (!result.ok || !result.text?.trim()) throw new Error(result.error || "引擎没有返回内容");
      if (alive.current) Toast.show({ type: "success", text1: "引擎连接正常" });
    } catch (reason) { fail(reason); }
    finally { working.current = false; if (alive.current) setBusy(false); }
  }

  function remove(item: AiProvider) {
    Alert.alert("删除 AI 引擎？", `删除「${item.name}」及其保存的配置。`, [{ text: "取消", style: "cancel" }, { text: "删除", style: "destructive", onPress: () => { void (async () => {
      if (working.current || !alive.current) return;
      working.current = true; setBusy(true); setError("");
      try { const result = await shellDeleteProvider(item.id) as { ok?: boolean; error?: string }; if (result.ok === false) throw new Error(result.error || "删除失败"); if (alive.current && draft.id === item.id) { setDraft(empty); setBaseline(empty); } await reload(); }
      catch (reason) { fail(reason); }
      finally { working.current = false; if (alive.current) setBusy(false); }
    })(); } }]);
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
                <Animated.View key={item.id}>
                  <Surface
                    tone={selected ? "raised" : "base"}
                    style={[
                      styles.card,
                      item.isDefault && { borderColor: colors.accentSoft },
                      selected && { borderColor: colors.accent },
                    ]}
                  >
                    <Pressy
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`编辑${item.name}`}
                      scale={0.985}
                      style={styles.main}
                      onPress={() => selectDraft({ ...item, apiKey: "" })}
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
                      disabled={busy}
                      accessibilityRole="button"
                      accessibilityLabel={`删除${item.name}`}
                      hitSlop={8}
                      scale={0.9}
                      onPress={() => remove(item)}
                      style={styles.remove}
                    >
                      <Icon name="close" size={16} color={colors.redText} strokeWidth={2} />
                    </Pressy>
                  </Surface>
                  <Pressy disabled={busy} accessibilityRole="button" onPress={() => Alert.alert("验证引擎连接", "将发送一条简短请求，可能消耗少量模型额度。", [{ text: "取消", style: "cancel" }, { text: "验证", onPress: () => void verify(item) }])} style={{ padding: 12 }}><Text style={{ color: colors.accentText }}>验证连接</Text></Pressy>
                </Animated.View>
              );
            })}
          </View>
        ) : null}

        <SectionTitle>{draft.id ? "编辑引擎" : "添加引擎"}</SectionTitle>
        <Surface tone="raised" radius={colors.radius.xl} style={styles.form}>
          {draft.id ? (
            <Pressy disabled={busy} accessibilityRole="button" onPress={() => selectDraft(empty)} scale={0.95} style={styles.reset}>
              <Icon name="plus" size={14} color={colors.accentText} strokeWidth={2} />
              <Text style={styles.resetText}>改为新增</Text>
            </Pressy>
          ) : null}

          <Input
            editable={!busy}
            label="名称"
            value={draft.name}
            placeholder="例如：OpenAI / DeepSeek / Grok"
            onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
          />
          <Input
            editable={!busy}
            label="接口地址"
            value={draft.baseUrl}
            placeholder="https://api.openai.com/v1"
            onChangeText={(baseUrl) => setDraft((current) => ({ ...current, baseUrl }))}
            autoCapitalize="none"
          />
          <Input
            editable={!busy}
            label="模型"
            value={draft.model}
            placeholder="例如：gpt-4o / grok-4.7-high"
            onChangeText={(model) => setDraft((current) => ({ ...current, model }))}
            autoCapitalize="none"
          />
          <Input
            editable={!busy}
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
            <Switch disabled={busy} checked={draft.isDefault} onCheckedChange={(isDefault) => setDraft((current) => ({ ...current, isDefault }))} />
          </View>

          {error ? (
            <Animated.View style={styles.errorRow}>
              <Icon name="alert" size={16} color={colors.redText} />
              <Text style={styles.error}>{error}</Text>
            </Animated.View>
          ) : null}

          <Pressy disabled={busy} accessibilityRole="button" onPress={() => void save()} style={styles.save}>
            {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.saveLabel}>{draft.id ? "保存修改" : "保存配置"}</Text>}
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
