import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Badge } from "../shadcn/Badge";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * FILTER TABLE
 * Status chips that reorganize live data.
 * ───────────────────────────────────────────────────────── */

export type FilterStatus = "All" | "Thriving" | "Steady" | "Retire";

export type FlavorBatchRow = {
  id: string;
  flavor: string;
  weeklyScoops: number;
  delta: string;
  status: Exclude<FilterStatus, "All">;
};

const DEFAULT_BATCHES: FlavorBatchRow[] = [
  { id: "b1", flavor: "Pistachio", weeklyScoops: 142, delta: "+18%", status: "Thriving" },
  { id: "b2", flavor: "Mint Chip", weeklyScoops: 118, delta: "+12%", status: "Thriving" },
  { id: "b3", flavor: "Madagascar Vanilla", weeklyScoops: 96, delta: "+6%", status: "Steady" },
  { id: "b4", flavor: "Rocky Road", weeklyScoops: 31, delta: "-11%", status: "Retire" },
];

const FILTERS: FilterStatus[] = ["All", "Thriving", "Steady", "Retire"];

export type FilterTableProps = {
  rows?: FlavorBatchRow[];
  style?: StyleProp<ViewStyle>;
};

export function FilterTable({ rows = DEFAULT_BATCHES, style }: FilterTableProps) {
  useTheme();
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("All");

  const filtered = useMemo(() => {
    if (activeFilter === "All") return rows;
    return rows.filter((r) => r.status === activeFilter);
  }, [rows, activeFilter]);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.chipBar}>
        {FILTERS.map((status) => {
          const selected = status === activeFilter;
          const count =
            status === "All"
              ? rows.length
              : rows.filter((r) => r.status === status).length;
          return (
            <Pressable
              key={status}
              onPress={() => setActiveFilter(status)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                {status}
              </Text>
              <Text style={[styles.chipCount, selected && styles.chipCountActive]}>
                {count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.table}>
        {filtered.map((item) => (
          <View key={item.id} style={styles.row}>
            <Text style={styles.flavor}>{item.flavor}</Text>
            <Text style={styles.scoops}>{item.weeklyScoops} scoops/wk</Text>
            <Badge
              tone={
                item.status === "Thriving"
                  ? "success"
                  : item.status === "Retire"
                    ? "danger"
                    : "secondary"
              }
            >
              {item.delta}
            </Badge>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  wrap: {
    gap: 8,
  },
  chipBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  chipActive: {
    backgroundColor: theme.text,
    borderColor: theme.text,
  },
  chipText: {
    color: theme.ink2,
    fontSize: 12,
    fontWeight: "500",
  },
  chipTextActive: {
    color: theme.ink,
    fontWeight: "600",
  },
  chipCount: {
    color: theme.muted,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  chipCountActive: {
    color: theme.ink,
    opacity: 0.7,
  },
  table: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    overflow: "hidden",
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
  flavor: {
    flex: 1,
    color: theme.text,
    fontSize: 13,
    fontWeight: "500",
  },
  scoops: {
    color: theme.muted,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
}));
