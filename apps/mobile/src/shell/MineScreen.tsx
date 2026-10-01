import { Fragment, memo, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Screen, ScreenBar } from "../../../../packages/ui/edge";
import { Icon, SectionTitle, Surface, type IconName } from "../../../../packages/ui/chrome";

import { themedStyleSheet, useTheme, type ThemeMode } from "../../../../packages/ui/theme";
import { readSummaryEvery, subscribeSummaryEvery, SUMMARY_CHOICES } from "../../../../packages/ui/feed";
import { bundles } from "../../../../packages/features/src/registry";

const bootstrap = require("../../../../tools/applications/bootstrap.json");

type CheckState = "idle" | "busy" | "ready" | "current" | "failed";

type Props = {
  mode: ThemeMode;
  onApplications: () => void;
  onCompanion: () => void;
  onProviders: () => void;
  onInfo: () => void;
  onCheckUpdates: () => Promise<boolean>;
  onSummary: () => void;
  onAppearance: () => void;
};

export const MineScreen = memo(function MineScreen({
  mode,
  onApplications,
  onCompanion,
  onProviders,
  onInfo,
  onCheckUpdates,
  onSummary,
  onAppearance,
}: Props) {
  const { colors } = useTheme();
  const companion = bundles.find(item => item.id === bootstrap.defaultApplication);
  const Avatar = companion?.avatar;
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
        <Text style={styles.caption}>一切都存在这台手机里</Text>
      </ScreenBar>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="打开 Jolly" onPress={onCompanion}><Surface tone="raised" radius={colors.radius.xl} lifted style={styles.profile}>
          <View style={styles.portrait}>
            {Avatar ? <Avatar size={68} animated borderRadius={22} /> : <Icon name="box" size={36} color={colors.accent} />}
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{companion?.title ?? "紫金花"}</Text>
            <Text style={styles.profileHint}>把一句心愿做成能打开的小应用</Text>
          </View>
        </Surface></Pressable>

        <SectionTitle>管理</SectionTitle>
        <Surface style={styles.group}>
          <Row icon="box" title="我的作品与应用" hint="创作、分享与安装管理" onPress={onApplications} />
          <Row icon="info" title="应用信息" hint="各个包的体积" onPress={onInfo} />
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
            last
          />
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
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 16,
    marginBottom: 6,
  },
  portrait: {
    width: 68,
    height: 68,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: t.accentSoft,
  },
  profileCopy: {
    flex: 1,
    gap: 3,
  },
  profileName: {
    fontFamily: t.serif,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    color: t.ink1,
  },
  profileHint: {
    fontSize: 13.5,
    lineHeight: 19,
    color: t.ink2,
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
