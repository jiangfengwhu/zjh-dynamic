import { AnimatedFlashList } from "./AnimatedFlashList";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { brandAssets } from "./feed/brandAssets";
import { Image } from "react-native";
import { EmptyState } from "./EmptyState";
import { useRouteRequestReady } from "./useRouteContentReady";
import { ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { PageHeader, Pressy, SectionTitle, Surface } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { createThemedStyles, useTheme } from "../../../../packages/ui/theme";
import { formatBytes, loadInstalledPackages, type InstalledPackage, type PackageKind } from "./packages";
const { sdk } = require("../runtime/application-contract.json") as { sdk: string };
const { buildId, apk } = require("./build-identity.json") as { buildId: string; apk?: { versionName: string; versionCode: number } };

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

let cachedPackages: InstalledPackage[] | undefined;

export function AppInfoScreen({ onBack }: Props) {
  const styles = useStyles();

  const { colors } = useTheme();
  const contentReady = useRouteRequestReady();
  const focused = useIsFocused() && contentReady;
  const [items, setItems] = useState<InstalledPackage[]>(() => cachedPackages ?? []);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [details, setDetails] = useState(false);

  useEffect(() => {
    if (!focused) return;
    let alive = true; setLoading(true); setError("");
    void loadInstalledPackages()
      .then((next) => {
        cachedPackages = next;
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
      <AnimatedFlashList<InstalledPackage | "extensions"> data={details ? [...packages, "extensions", ...dexes] : []} keyExtractor={item => typeof item === "string" ? item : item.kind + ":" + item.id} getItemType={item => typeof item === "string" ? "heading" : "package"} maintainVisibleContentPosition={{ disabled: true }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
        ListHeaderComponent={<View style={{ gap: 12 }}>
        <Surface style={styles.version}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Image accessible={false} fadeDuration={0} source={{ uri: `data:image/webp;base64,${brandAssets.logo.base64}` }} style={{ width: 48, height: 48, borderRadius: 14 }} /><Text accessibilityRole="header" style={styles.brand}>生花</Text></View><View style={styles.metrics}><View style={styles.metric}><Text style={styles.empty}>APK 版本</Text><Text style={styles.metricValue}>{apk?.versionName ?? sdk}</Text></View><View style={styles.metric}><Text style={styles.empty}>SDK 版本</Text><Text selectable style={styles.metricValue}>{sdk}</Text></View><View style={styles.metric}><Text style={styles.empty}>界面版本</Text><Text selectable style={styles.metricValue}>{buildId.slice(0, 8)}</Text></View></View><View style={styles.storage}><Text style={styles.empty}>本机安装文件</Text><View style={styles.storageValue}><View style={styles.loadingSlot}>{loading ? <ActivityIndicator size="small" color={colors.ink2} /> : null}</View><Text style={styles.metricValue}>{cachedPackages !== undefined ? formatBytes(total) : error ? "未读取" : "读取中"}</Text></View></View></Surface>
        {error ? <Pressy accessibilityRole="button" onPress={() => setAttempt(value => value + 1)}><Text style={styles.error}>{error} · 重试</Text></Pressy> : null}
        <Text style={styles.empty}>页面运行包负责界面，原生扩展提供手机能力。下方体积为本机安装文件大小。</Text>
        <Pressy accessibilityRole="button" accessibilityState={{ expanded: details }} onPress={() => setDetails(value => !value)}><Text style={styles.total}>{details ? "收起技术详情" : "查看技术详情"}</Text></Pressy>
        </View>}
        renderItem={({ item }) => typeof item === "string" ? <SectionTitle>原生扩展（技术详情）</SectionTitle> : <Surface style={styles.group}><PackageRow item={item} last /></Surface>}
        ListFooterComponent={details && !loading && !error && !dexes.length ? <EmptyState style={{ minHeight: 120, flexGrow: 0 }}><Text style={styles.empty}>还没有安装原生扩展</Text></EmptyState> : null}
      />
    </Screen>
  );
}

function PackageRow({ item, last }: { item: InstalledPackage; last: boolean }) {
  const styles = useStyles();

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
  version: { padding: 16, gap: 14, borderRadius: t.radius.xl },
  brand: { color: t.ink1, ...t.type.title2 },
  metrics: { flexDirection: "row", gap: 12 },
  metric: { flex: 1, gap: 4 },
  metricValue: { fontFamily: t.mono, fontSize: 14, lineHeight: 20, fontWeight: "700", color: t.ink1 },
  storage: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.line },
  storageValue: { flexDirection: "row", alignItems: "center", gap: 6 },
  loadingSlot: { width: 20, height: 20, alignItems: "center", justifyContent: "center" },
  group: {
    borderRadius: t.radius.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
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
    color: t.ink2,
  },
  sizeMissing: {
    color: t.orangeText,
  },
  total: {
    fontSize: 13,
    fontWeight: "700",
    color: t.ink1,
    paddingHorizontal: 4,
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
