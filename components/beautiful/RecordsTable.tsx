import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Badge } from "../shadcn/Badge";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * RECORDS TABLE
 * CRM-style grid with tags, sorting, and relationship status.
 * ───────────────────────────────────────────────────────── */

export type CreameryRecord = {
  id: string;
  name: string;
  domain: string;
  tag: string;
  status: "Active" | "Partner" | "Warm";
  arrUsd: number;
};

const DEFAULT_RECORDS: CreameryRecord[] = [
  { id: "r1", name: "Alpine Churn — Zürich", domain: "alpine-churn.example.com", tag: "Artisan", status: "Partner", arrUsd: 48200 },
  { id: "r2", name: "Blue Fig Gelato — Florence", domain: "blue-fig.example.com", tag: "Gelato", status: "Active", arrUsd: 62900 },
  { id: "r3", name: "Kumo Creamery — Tokyo", domain: "kumo-creamery.example.com", tag: "Soft Serve", status: "Partner", arrUsd: 81500 },
  { id: "r4", name: "Lumen Soft Serve — Copenhagen", domain: "lumen-soft-serve.example.com", tag: "Nordic", status: "Warm", arrUsd: 29400 },
];

export type RecordsTableProps = {
  records?: CreameryRecord[];
  style?: StyleProp<ViewStyle>;
};

export function RecordsTable({ records = DEFAULT_RECORDS, style }: RecordsTableProps) {
  useTheme();
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    return [...records].sort((a, b) =>
      sortAsc ? a.arrUsd - b.arrUsd : b.arrUsd - a.arrUsd,
    );
  }, [records, sortAsc]);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.headerRow}>
        <Text style={[styles.headCell, { flex: 1 }]}>Account</Text>
        <Text style={styles.headCell}>Status</Text>
        <Pressable onPress={() => setSortAsc((v) => !v)} style={styles.sortBtn}>
          <Text style={styles.headCell}>Volume {sortAsc ? "↑" : "↓"}</Text>
        </Pressable>
      </View>

      {sorted.map((rec) => (
        <View key={rec.id} style={styles.row}>
          <View style={styles.accountCol}>
            <Text style={styles.name} numberOfLines={1}>
              {rec.name}
            </Text>
            <Text style={styles.domain} numberOfLines={1}>
              {rec.domain} · {rec.tag}
            </Text>
          </View>

          <Badge
            tone={
              rec.status === "Partner"
                ? "success"
                : rec.status === "Active"
                  ? "accent"
                  : "warning"
            }
          >
            {rec.status}
          </Badge>

          <Text style={styles.arr}>
            ${(rec.arrUsd / 1000).toFixed(1)}k
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.inset,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  headCell: {
    color: theme.muted,
    fontSize: 11.5,
    fontWeight: "600",
  },
  sortBtn: {
    width: 66,
    alignItems: "flex-end",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  accountCol: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "500",
  },
  domain: {
    color: theme.muted,
    fontSize: 11,
  },
  arr: {
    width: 66,
    textAlign: "right",
    color: theme.ink2,
    fontSize: 12.5,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
  },
}));
