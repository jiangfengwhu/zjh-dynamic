import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { PageHeader, Pressy, SectionTitle, Surface } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { formatBytes, loadInstalledPackages, type InstalledPackage, type PackageKind } from "./packages";
const { sdk } = require("../runtime/application-contract.json") as { sdk: string };
const { buildId } = require("./build-identity.json") as { buildId: string };

type Props = {
  onBack: () => void;
};

const layerTitle: Record<string, string> = {
  vendor: "第三方库",
  app: "应用代码",
  release: "完整运行环境",
};

const kindLabel: Record<PackageKind, string> = {
  layer: "页面运行包",
  plugin: "原生扩展",
};

export function AppInfoScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const focused = useIsFocused();
  const [items, setItems] = useState<InstalledPackage[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [details, setDetails] = useState(false);

  useEffect(() => {
    if (!focused) return;
    let alive = true; setLoading(true); setError("");
    void loadInstalledPackages()
      .then((next) => {
        if (!alive) return;
        setItems(next);
        setError("");
      })
      .catch((reason) => {
        if (!alive) return;
        const message = reason instanceof Error ? reason.message : String(reason);
        console.log("packages unreadable", message);
        setError("应用信息暂时无法读取，请重试");
      }).finally(() => { if (alive) setLoading(false); });
    return () => {
      alive = false;
    };
  }, [focused, attempt]);

  const packages = items.filter((item) => item.kind !== "plugin");
  const dexes = items.filter((item) => item.kind === "plugin");
  const total = items.reduce((sum, item) => sum + (item.present ? item.bytes : 0), 0);

  return (
    <Screen style={styles.screen}>
      <PageHeader title="应用信息" caption="本机正在使用的包" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Surface style={styles.version}><Text accessibilityRole="header" style={styles.brand}>紫金花</Text><View style={styles.metrics}><View style={styles.metric}><Text style={styles.empty}>平台版本</Text><Text style={styles.metricValue}>{sdk}</Text></View><View style={styles.metric}><Text style={styles.empty}>界面版本</Text><Text selectable style={styles.metricValue}>{buildId.slice(0, 8)}</Text></View></View><View style={styles.storage}><Text style={styles.empty}>本机安装文件</Text><Text style={styles.metricValue}>{formatBytes(total)}</Text></View></Surface>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        {error ? <Pressy accessibilityRole="button" onPress={() => setAttempt(value => value + 1)}><Text style={styles.error}>{error} · 重试</Text></Pressy> : null}
        <Text style={styles.empty}>页面运行包负责界面，原生扩展提供手机能力。下方体积为本机安装文件大小。</Text>
        <Pressy accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails(value => !value)}><Text style={styles.total}>{details ? "收起技术详情" : "查看技术详情"}</Text></Pressy>
        {details ? <>
        {packages.length > 0 ? (
          <Surface style={styles.group}>
            {packages.map((item, index) => (
              <PackageRow key={`${item.kind}:${item.id}`} item={item} last={index === packages.length - 1} />
            ))}
          </Surface>
        ) : null}

        <SectionTitle>原生扩展（技术详情）</SectionTitle>
        {!loading && !error && dexes.length === 0 ? (
          <Text style={styles.empty}>还没有安装</Text>
        ) : (
          <Surface style={styles.group}>
            {dexes.map((item, index) => (
              <PackageRow key={`${item.kind}:${item.id}`} item={item} last={index === dexes.length - 1} />
            ))}
          </Surface>
        )}
        </> : null}
      </ScrollView>
    </Screen>
  );
}

function PackageRow({ item, last }: { item: InstalledPackage; last: boolean }) {
  useTheme();
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.cardMain}>
          <Text style={styles.cardTitle}>{titleOf(item)}</Text>
          <Text style={styles.cardHint}>
            {kindLabel[item.kind]}，{item.id}
            {item.kind === "plugin" ? ".dex" : ""}
          </Text>
        </View>
        <Text style={[styles.size, !item.present && styles.sizeMissing]}>
          {item.present ? formatBytes(item.bytes) : "缺失"}
        </Text>
      </View>
      {last ? null : <View style={styles.divider} />}
    </View>
  );
}

function titleOf(item: InstalledPackage): string {
  if (item.kind === "layer") return layerTitle[item.id] ?? item.id;
  return item.id;
}

const styles = themedStyleSheet((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 10,
  },
  version: { padding: 12, gap: 12 },
  brand: { color: t.ink1, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  metrics: { flexDirection: "row", gap: 12 },
  metric: { flex: 1, gap: 4 },
  metricValue: { fontFamily: t.mono, fontSize: 14, lineHeight: 20, fontWeight: "600", color: t.ink1 },
  storage: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: t.line },
  group: {
    borderRadius: t.radius.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
    backgroundColor: t.line,
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: t.ink1,
  },
  cardHint: {
    fontSize: 12,
    lineHeight: 17,
    color: t.ink3,
  },
  size: {
    fontFamily: t.mono,
    fontSize: 13,
    fontWeight: "600",
    color: t.accentText,
  },
  sizeMissing: {
    color: t.orangeText,
  },
  total: {
    fontFamily: t.mono,
    fontSize: 12.5,
    color: t.ink3,
  },
  error: {
    fontSize: 13,
    color: t.orangeText,
  },
  empty: {
    paddingHorizontal: 4,
    fontSize: 13.5,
    color: t.ink3,
  },
}));
