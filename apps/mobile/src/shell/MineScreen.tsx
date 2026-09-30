import { Fragment, memo, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen, ScreenBar } from "../../../../packages/ui/edge";
import { Icon, SectionTitle, Surface, type IconName } from "../../../../packages/ui/chrome";
import { FriendAvatar } from "../../../../packages/ui/feed";
import { bundles } from "../../../../packages/features/src/registry";
import { useCompanionName } from "../../../../packages/ui/jolly/name";
import type { AppEntry } from "./catalog";
import { themedStyleSheet, useTheme, type ThemeMode } from "../../../../packages/ui/theme";
import { readSummaryEvery, subscribeSummaryEvery, SUMMARY_CHOICES } from "../../../../packages/ui/feed";

type CheckState = "idle" | "busy" | "ready" | "current" | "failed";

type Props = {
  mode: ThemeMode;
  apps: AppEntry[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onProviders: () => void;
  onInfo: () => void;
  onCheckUpdates: () => Promise<boolean>;
  onSummary: () => void;
  onAppearance: () => void;
};

export const MineScreen = memo(function MineScreen({
  mode,
  apps,
  onOpen,
  onNew,
  onProviders,
  onInfo,
  onCheckUpdates,
  onSummary,
  onAppearance,
}: Props) {
  const { colors } = useTheme();
  const companionName = useCompanionName();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState(false);
  const visible = apps
    .filter((app) => !recent || Boolean(app.lastOpenedAt))
    .filter((app) => `${app.id === "jolly" ? companionName : app.title} ${app.summary}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
  const [summaryEvery, setSummaryEvery] = useState(() => readSummaryEvery());
  const [check, setCheck] = useState<CheckState>("idle");
  useEffect(() => subscribeSummaryEvery(setSummaryEvery), []);

  async function checkUpdates() {
    if (check === "busy") return;
    setCheck("busy");
    try {
      const found = await onCheckUpdates();
      setCheck(found ? "ready" : "current");
      console.log("release check manual", found ? "ready" : "current");
    } catch (error) {
      console.log("release check manual failed", error instanceof Error ? error.message : error);
      setCheck("failed");
    }
  }

  return (
    <Screen style={styles.screen}>
      <ScreenBar style={styles.header}>
        <Text style={styles.title}>我的</Text>
        <Text style={styles.caption}>你的工具，慢慢长成你喜欢的样子</Text>
      </ScreenBar>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.libraryHead}>
          <Text style={styles.libraryTitle}>我的应用</Text>
          <Pressable accessibilityRole="button" onPress={onNew} style={styles.createButton}>
            <Icon name="plus" size={16} color={colors.accentText} />
            <Text style={styles.createText}>做一个新的</Text>
          </Pressable>
        </View>
        <TextInput accessibilityLabel="搜索我的应用" placeholder="搜索应用" placeholderTextColor={colors.ink3} value={query} onChangeText={setQuery} style={styles.search} />
        <View style={styles.filters}>
          {[false, true].map((isRecent) => (
            <Pressable key={String(isRecent)} accessibilityRole="tab" accessibilityState={{ selected: recent === isRecent }} onPress={() => setRecent(isRecent)} style={[styles.filter, recent === isRecent && styles.filterActive]}>
              <Text style={[styles.filterText, recent === isRecent && styles.filterTextActive]}>{isRecent ? "最近使用" : `全部应用 · ${apps.length}`}</Text>
            </Pressable>
          ))}
        </View>
        <Surface style={styles.group}>
          {visible.map((app, index) => {
            const definition = bundles.find((bundle) => bundle.id === app.id);
            const name = app.id === "jolly" ? companionName : app.title;
            return (
              <Fragment key={app.id}>
                <Pressable accessibilityRole="button" accessibilityLabel={`打开${name}`} onPress={() => onOpen(app.id)} style={({ pressed }) => [styles.appRow, pressed && { backgroundColor: colors.hover }]}>
                  <FriendAvatar friend={{ id: app.id, name, mark: definition?.mark ?? "应", accent: definition?.accent ?? colors.orchid, Avatar: definition?.avatar }} size={44} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{name}</Text>
                    <Text style={styles.appSummary} numberOfLines={2}>{app.summary}</Text>
                  </View>
                  <Icon name="chevron" size={18} color={colors.ink3} />
                </Pressable>
                {index < visible.length - 1 ? <View style={styles.divider} /> : null}
              </Fragment>
            );
          })}
          {visible.length === 0 ? (
            <View style={styles.libraryEmpty}>
              <Text style={styles.rowTitle}>{query.trim() ? "没有找到这个应用" : recent ? "还没有最近使用的应用" : "做出你的第一个小应用"}</Text>
              <Text style={styles.appSummary}>{query.trim() ? "试试其他名字。" : recent ? "打开一次应用，下次就能在这里找到。" : "把一个日常需要，交给工坊里的伙伴。"}</Text>
              <Pressable accessibilityRole="button" onPress={() => { if (query.trim()) setQuery(""); else if (recent) setRecent(false); else onNew(); }} style={styles.createButton}>
                <Text style={styles.createText}>{query.trim() ? "清除搜索" : recent ? "查看全部应用" : "去工坊许愿"}</Text>
              </Pressable>
            </View>
          ) : null}
        </Surface>

        <SectionTitle>设置</SectionTitle>
        <Surface style={styles.group}>
          <Row
            icon="cloud"
            title="检查更新"
            hint={check === "busy" ? "正在向线上核对这一整套" : "每 30 分钟也会自动检查"}
            value={checkLabel(check)}
            warn={check === "failed"}
            onPress={() => {
              void checkUpdates();
            }}
          />
          <Row icon="engine" title="AI 引擎" hint="小结和创作使用的模型" onPress={onProviders} />
          <Row
            icon="clock"
            title="动态小结"
            hint="到点后按变化写一条动态"
            value={summaryLabel(summaryEvery)}
            onPress={onSummary}
          />
          <Row
            icon={mode === "dark" ? "moon" : "sun"}
            title="外观"
            hint="夜紫或淡纸"
            value={mode === "dark" ? "夜紫" : "淡纸"}
            onPress={onAppearance}
          />
          <Row icon="info" title="应用信息" hint="版本和存储信息" onPress={onInfo} last />
        </Surface>
      </ScrollView>
    </Screen>
  );
});

function Row({
  icon,
  title,
  hint,
  value,
  warn,
  last,
  onPress,
}: {
  icon: IconName;
  title: string;
  hint: string;
  value?: string;
  warn?: boolean;
  last?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Fragment>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        android_ripple={{ color: colors.accentTint }}
        style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.hover }]}
      >
        <View style={styles.rowIcon}>
          <Icon name={icon} size={19} color={colors.accentText} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowHint} numberOfLines={1}>
            {hint}
          </Text>
        </View>
        {value ? <Text style={[styles.rowValue, warn && { color: colors.orangeText }]}>{value}</Text> : null}
        <Icon name="chevron" size={16} color={colors.ink3} />
      </Pressable>
      {last ? null : <View style={styles.divider} />}
    </Fragment>
  );
}

function checkLabel(state: CheckState): string | undefined {
  if (state === "busy") return "检查中";
  if (state === "ready") return "有更新";
  if (state === "current") return "已是最新";
  if (state === "failed") return "没查到";
  return undefined;
}

function summaryLabel(ms: number): string {
  const choice = SUMMARY_CHOICES.find((item) => item.ms === ms);
  if (choice) return choice.label;
  if (ms <= 0) return "关闭";
  return `${Math.round(ms / 60000)} 分钟`;
}

const styles = themedStyleSheet((t) => ({
  libraryHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginTop: 8 },
  libraryTitle: { color: t.ink1, fontSize: 20, fontWeight: "700" },
  createButton: { minHeight: 44, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 14, backgroundColor: t.accentTint },
  createText: { color: t.accentText, fontSize: 14, fontWeight: "600" },
  search: { color: t.ink1, fontSize: 15, minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, backgroundColor: t.field, borderWidth: StyleSheet.hairlineWidth, borderColor: t.lineStrong },
  filters: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  filter: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 14 },
  filterActive: { backgroundColor: t.orchidTint },
  filterText: { color: t.ink2, fontSize: 14 },
  filterTextActive: { color: t.orchidText, fontWeight: "700" },
  appRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, minHeight: 88 },
  appSummary: { color: t.ink2, fontSize: 14, lineHeight: 21 },
  libraryEmpty: { alignItems: "center", gap: 12, padding: 24 },
  screen: {
    backgroundColor: t.canvas,
  },
  fill: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 1,
    backgroundColor: t.canvas,
  },
  title: {
    fontFamily: t.serif,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    color: t.ink1,
    letterSpacing: 2,
  },
  caption: {
    fontSize: 12.5,
    lineHeight: 17,
    color: t.ink3,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 40,
    gap: 12,
  },
  group: {
    borderRadius: t.radius.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.accentTint,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowTitle: {
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: "600",
    color: t.ink1,
  },
  rowHint: {
    fontSize: 12.5,
    lineHeight: 17,
    color: t.ink3,
  },
  rowValue: {
    fontSize: 13,
    color: t.ink3,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 66,
    backgroundColor: t.line,
  },
}));
