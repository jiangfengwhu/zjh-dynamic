import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * THINKING STATE
 * Expandable agent trace — Steps, Reasoning, Search, Coding.
 * ───────────────────────────────────────────────────────── */

export type ThinkingRow = {
  primary: string;
  secondary?: string;
  mono?: boolean;
  status?: "done" | "running";
};

export type ThinkingVariant = "Steps" | "Reasoning" | "Search" | "Coding";

const DEFAULT_ROWS: Record<ThinkingVariant, ThinkingRow[]> = {
  Steps: [
    { primary: "Loaded Q3–Q4 creamery sales ledger", secondary: "1,420 rows", mono: true, status: "done" },
    { primary: "Filtered seasonal stone-fruit SKUs", secondary: "18 matches", mono: true, status: "done" },
    { primary: "Computing weekend margin delta", secondary: "running", mono: true, status: "running" },
  ],
  Reasoning: [
    { primary: "Pistachio velocity (+23%) outpaces cold-chain restock lead time (7d).", status: "done" },
    { primary: "Recommending early Saturday churn to prevent Sunday afternoon stockout.", status: "done" },
  ],
  Search: [
    { primary: "scoopdata.io/trends/q4-gelato", secondary: "98% match", mono: true, status: "done" },
    { primary: "marketbasket.io/dairy/cold-chain", secondary: "91% match", mono: true, status: "done" },
  ],
  Coding: [
    { primary: "Read", secondary: "src/inventory/churnBatch.ts", mono: true, status: "done" },
    { primary: "Edit", secondary: "+14 -3 lines", mono: true, status: "done" },
    { primary: "Run", secondary: "npm test -- churn.spec.ts", mono: true, status: "done" },
  ],
};

export type ThinkingStateProps = {
  variant?: ThinkingVariant;
  rows?: ThinkingRow[];
  active?: string;
  done?: string;
  working?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ThinkingState({
  variant = "Coding",
  rows,
  active,
  done,
  working = false,
  style,
}: ThinkingStateProps) {
  useTheme();
  const [open, setOpen] = useState(true);
  const list = rows ?? DEFAULT_ROWS[variant];
  const title = working
    ? active ?? `Thinking (${variant})`
    : done ?? `Thought for 3.2s · ${variant}`;

  return (
    <View style={[styles.wrap, style]}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.header}>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
        <View style={[styles.dot, working ? styles.dotActive : styles.dotDone]} />
        <Text style={styles.title}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.meta}>{list.length}</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.traceList}>
          {list.map((row, index) => (
            <View key={`${row.primary}-${index}`} style={styles.row}>
              <View style={styles.rail} />
              <Text style={styles.primary} numberOfLines={2}>
                {row.primary}
              </Text>
              {row.secondary ? (
                <Text style={[styles.secondary, row.mono && styles.mono]} numberOfLines={1}>
                  {row.secondary}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  wrap: {
    gap: 2,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  chevron: {
    color: theme.muted,
    fontSize: 12,
    width: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: theme.accent,
  },
  dotDone: {
    backgroundColor: theme.green,
  },
  title: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.inset,
  },
  meta: {
    color: theme.muted,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  traceList: {
    paddingLeft: 6,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 26,
    paddingLeft: 10,
  },
  rail: {
    width: 1.5,
    height: 16,
    backgroundColor: theme.lineStrong,
    borderRadius: 1,
  },
  primary: {
    color: theme.ink2,
    fontSize: 12.5,
    flex: 1,
  },
  secondary: {
    color: theme.muted,
    fontSize: 11.5,
    backgroundColor: theme.inset,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  mono: {
    fontVariant: ["tabular-nums"],
  },
}));
