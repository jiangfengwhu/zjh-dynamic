import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { PageHeader, SectionTitle, Surface } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { formatBytes, loadInstalledPackages, type InstalledPackage, type PackageKind } from "./packages";

type Props = {
  onBack: () => void;
};

const layerTitle: Record<string, string> = {
  vendor: "第三方库",
  app: "应用代码",
  release: "一整套",
};

const kindLabel: Record<PackageKind, string> = {
  layer: "JS 包",
  plugin: "DEX",
};

export function AppInfoScreen({ onBack }: Props) {
  useTheme();
  const focused = useIsFocused();
  const [items, setItems] = useState<InstalledPackage[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!focused) return;
    let alive = true;
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
        setError(message);
      });
    return () => {
      alive = false;
    };
  }, [focused]);

  const packages = items.filter((item) => item.kind !== "plugin");
  const dexes = items.filter((item) => item.kind === "plugin");
  const total = items.reduce((sum, item) => sum + (item.present ? item.bytes : 0), 0);

  return (
    <Screen style={styles.screen}>
      <PageHeader title="应用信息" caption="本机正在使用的包" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <SectionTitle aside={items.length > 0 ? <Text style={styles.total}>{formatBytes(total)}</Text> : null}>
          当前包
        </SectionTitle>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {packages.length > 0 ? (
          <Surface style={styles.group}>
            {packages.map((item, index) => (
              <PackageRow key={`${item.kind}:${item.id}`} item={item} last={index === packages.length - 1} />
            ))}
          </Surface>
        ) : null}

        <SectionTitle>DEX</SectionTitle>
        {dexes.length === 0 ? (
          <Text style={styles.empty}>还没有安装</Text>
        ) : (
          <Surface style={styles.group}>
            {dexes.map((item, index) => (
              <PackageRow key={`${item.kind}:${item.id}`} item={item} last={index === dexes.length - 1} />
            ))}
          </Surface>
        )}
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
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 36,
    gap: 10,
  },
  group: {
    borderRadius: t.radius.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    fontSize: 15.5,
    lineHeight: 21,
    fontWeight: "600",
    color: t.ink1,
  },
  cardHint: {
    fontSize: 12.5,
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
