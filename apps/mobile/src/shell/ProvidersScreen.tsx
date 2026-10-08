import { AnimatedFlashList } from "./AnimatedFlashList";
import { PageSkeleton } from "./LoadingSkeleton";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { useRouteRequestReady } from "./useRouteContentReady";
import { ActivityIndicator } from "react-native";
import { HostAlert as Alert } from "./HostAlert";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView as ScrollView } from "react-native-keyboard-controller";
import { useDiscardChanges, confirmDiscard } from "./useDiscardChanges";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { Icon, PageHeader, Pressy, SectionTitle, Surface } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { Input } from "../../../../packages/ui/primitives/Input";
import { Switch } from "../../../../packages/ui/primitives/Switch";
import { createThemedStyles, useTheme } from "../../../../packages/ui/theme";
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

// Keep only display metadata in memory; API keys stay in native storage.
let cachedProviders: AiProvider[] | undefined;

export function ProvidersScreen({ onBack }: Props) {
  const styles = useStyles();

  const { colors } = useTheme();
  const [items, setItems] = useState<AiProvider[]>(() => cachedProviders ?? []);
  const [draft, setDraft] = useState(empty);
  const [editing, setEditing] = useState(false);
  const [baseline, setBaseline] = useState(empty);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  useDiscardChanges(dirty);
  function selectDraft(next: typeof empty) { const apply = () => { setDraft(next); setBaseline(next); setEditing(true); }; if (dirty) confirmDiscard(apply); else apply(); }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [loaded, setLoaded] = useState(cachedProviders !== undefined);
  const [attempt, setAttempt] = useState(0);
  const contentReady = useRouteRequestReady();
  const working = useRef(false); const alive = useRef(true);
  function fail(reason: unknown) {
    if (!alive.current) return;
    const message = reason instanceof Error ? reason.message : "操作未完成，请重试";
    setError(message); Toast.show({ type: "error", text1: "AI 引擎操作未完成", text2: message });
  }

  async function reload() {
    const result = await shellProviders();
    if (!result.ok) throw new Error("无法读取 AI 引擎，请重试");
    cachedProviders = (result.items ?? []).map(item => ({ ...item, apiKey: "" }));
    if (alive.current) { setItems(cachedProviders); setLoaded(true); }
  }

  useEffect(() => {
    if (!contentReady) return;
    alive.current = true;
    working.current = true; setBusy(true); setError("");
    void reload().catch(fail).finally(() => { working.current = false; if (alive.current) setBusy(false); });
    return () => { alive.current = false; };
  }, [contentReady, attempt]);

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
    if (alive.current) { setDraft(empty); setBaseline(empty); setEditing(false); }
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
        caption="管理创作和动态小结使用的模型"
        onBack={onBack}
        right={<Pressy accessibilityLabel="添加 AI 引擎" style={styles.add} disabled={busy} onPress={() => selectDraft(empty)}><Icon name="plus" size={20} strokeWidth={2.4} color={colors.onAccent} /></Pressy>}
      />

      <AnimatedFlashList data={items} keyExtractor={item => item.id} extraData={{ draft, busy }} maintainVisibleContentPosition={{ disabled: true }} renderScrollComponent={ScrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        ListHeaderComponent={<>
        {!loaded ? error ? <Surface style={styles.loading}><Text style={styles.meta}>{error}</Text><Pressy accessibilityRole="button" accessibilityLabel="重试读取引擎配置" onPress={() => setAttempt(value => value + 1)} style={styles.retry}><Text style={styles.resetText}>重试</Text></Pressy></Surface> : <PageSkeleton rows={3} shape="provider" /> : null}
        {error && !editing && items.length ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {items.length ? <SectionTitle>已接入</SectionTitle> : null}
        </>}
        renderItem={({ item }) => {
              const selected = draft.id === item.id;
              return (
                <View style={{ marginBottom: 12 }}>
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
                          <View style={[styles.badge, { backgroundColor: colors.accentTint }]}>
                            <Text style={[styles.badgeText, { color: colors.accentText }]}>编辑中</Text>
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
                  <Pressy disabled={busy} accessibilityRole="button" onPress={() => Alert.alert("验证引擎连接", "将发送一条简短请求，可能消耗少量模型额度。", [{ text: "取消", style: "cancel" }, { text: "验证", onPress: () => void verify(item) }])} style={styles.verify}><Text style={{ color: colors.orchidText, fontSize: 13, fontWeight: "600" }}>验证连接</Text></Pressy>
                </View>
              );
        }}
        ListFooterComponent={<>


        {editing || (loaded && !items.length) ? <>
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
            <Switch accessibilityLabel="设为默认引擎" disabled={busy} checked={draft.isDefault} onCheckedChange={(isDefault) => setDraft((current) => ({ ...current, isDefault }))} />
          </View>

          {error ? (
            <View style={styles.errorRow}>
              <Icon name="alert" size={16} color={colors.redText} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : null}

          <Pressy disabled={busy} accessibilityRole="button" onPress={() => void save()} style={styles.save}>
            {busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.saveLabel}>{draft.id ? "保存修改" : "保存配置"}</Text>}
          </Pressy>
        </Surface>
        </> : loaded ? <Text style={styles.meta}>平台和应用共用这些配置；点击引擎编辑，右上角添加。</Text> : null}

        </>}
      />
    </Screen>
  );
}

const useStyles = createThemedStyles((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 20,
    gap: 10,
  },
  loading: { minHeight: 80, padding: 16, gap: 8, justifyContent: "center" },
  retry: { minHeight: 40, justifyContent: "center" },
  add: { width: 36, height: 36, minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: t.accent, paddingHorizontal: 0, paddingVertical: 0 },
  verify: { alignSelf: "flex-end", paddingHorizontal: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: t.radius.xl,
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingVertical: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    flexShrink: 1,
    fontFamily: t.serif,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    color: t.ink1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
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
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.redTint,
  },
  form: {
    padding: 14,
    gap: 10,
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
    fontWeight: "700",
    color: t.ink1,
  },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: t.radius.md,
    backgroundColor: t.surfaceRaised,
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
    minHeight: t.components.controlHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: t.radius.pill,
    backgroundColor: t.accent,
  },
  saveLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: t.onAccent,
  },
}));
