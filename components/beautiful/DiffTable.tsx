import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Button } from "../shadcn/Button";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * DIFF TABLE
 * AI-proposed edits sweeping through tabular data.
 * ───────────────────────────────────────────────────────── */

export type DiffRowItem = {
  id: string;
  shop: string;
  field: string;
  before: string;
  after: string;
  status?: "pending" | "accepted" | "rejected";
};

const DEFAULT_DIFF_ROWS: DiffRowItem[] = [
  { id: "d1", shop: "Alpine Churn — Zürich", field: "Par Level", before: "40 tubs", after: "55 tubs" },
  { id: "d2", shop: "Kumo Creamery — Tokyo", field: "Lead Time", before: "9 days", after: "6 days" },
  { id: "d3", shop: "Blue Fig Gelato — Florence", field: "Status", before: "Watch", after: "Active" },
];

export type DiffTableProps = {
  rows?: DiffRowItem[];
  onAcceptAll?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function DiffTable({ rows: initialRows = DEFAULT_DIFF_ROWS, onAcceptAll, style }: DiffTableProps) {
  useTheme();
  const [rows, setRows] = useState<DiffRowItem[]>(initialRows);

  const updateRow = (id: string, status: "accepted" | "rejected") => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const acceptAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, status: "accepted" })));
    onAcceptAll?.();
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Proposed Table Edits ({rows.length})</Text>
        <Button variant="accent" size="sm" label="Accept All" onPress={acceptAll} />
      </View>

      {rows.map((row) => (
        <View key={row.id} style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.shop} numberOfLines={1}>
              {row.shop}
            </Text>
            <Text style={styles.field}>{row.field}</Text>
          </View>

          <View style={styles.diffPills}>
            <View style={styles.delPill}>
              <Text style={styles.delText}>{row.before}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
            <View style={styles.addPill}>
              <Text style={styles.addText}>{row.after}</Text>
            </View>
          </View>

          {row.status ? (
            <Text style={row.status === "accepted" ? styles.acceptedMark : styles.rejectedMark}>
              {row.status === "accepted" ? "✓" : "✕"}
            </Text>
          ) : (
            <View style={styles.rowActions}>
              <Pressable onPress={() => updateRow(row.id, "accepted")} style={styles.miniBtn}>
                <Text style={styles.miniCheck}>✓</Text>
              </Pressable>
              <Pressable onPress={() => updateRow(row.id, "rejected")} style={styles.miniBtn}>
                <Text style={styles.miniCross}>✕</Text>
              </Pressable>
            </View>
          )}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  headerTitle: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  shop: {
    color: theme.text,
    fontSize: 12.5,
    fontWeight: "500",
  },
  field: {
    color: theme.muted,
    fontSize: 11,
  },
  diffPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  delPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.redTint,
  },
  delText: {
    color: theme.redText,
    fontSize: 11,
    textDecorationLine: "line-through",
  },
  arrow: {
    color: theme.muted,
    fontSize: 11,
  },
  addPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.greenTint,
  },
  addText: {
    color: theme.greenText,
    fontSize: 11,
    fontWeight: "600",
  },
  rowActions: {
    flexDirection: "row",
    gap: 4,
  },
  miniBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.inset,
    alignItems: "center",
    justifyContent: "center",
  },
  miniCheck: {
    color: theme.greenText,
    fontSize: 12,
    fontWeight: "700",
  },
  miniCross: {
    color: theme.redText,
    fontSize: 11,
    fontWeight: "700",
  },
  acceptedMark: {
    color: theme.greenText,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 6,
  },
  rejectedMark: {
    color: theme.redText,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 6,
  },
}));
