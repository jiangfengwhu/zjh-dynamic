import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * TASK ROWS
 * Variants:
 *   Capsules — rounded individual cards with gap (default)
 *   List     — unified bordered card with hairline row dividers
 *
 * Statuses:
 *   done     — green check badge + Completed pill
 *   running  — active step badge, no pill
 *   error    — red X badge + Failed pill
 *   sequence — animated pending → failed (with retry) → completed
 * ───────────────────────────────────────────────────────── */

export type TaskDetail = { label: string; meta: string };

export type TaskRow = {
  key: string;
  label: string;
  amount: string;
  status: "done" | "running" | "error" | "sequence";
  step?: number;
  details: TaskDetail[];
};

export type TaskRowsVariant = "Capsules" | "List";

export type TaskRowsLabels = {
  completed?: string;
  failed?: string;
  running?: string;
};

const DEFAULT_ROWS: TaskRow[] = [
  {
    key: "verify",
    label: "Verified vendor records",
    amount: "12 suppliers",
    status: "done",
    details: [
      { label: "Matched tax and contact IDs", meta: "12/12" },
      { label: "Flagged stale records", meta: "0" },
    ],
  },
  {
    key: "index",
    label: "Build reorder task list",
    amount: "7 SKUs",
    status: "running",
    step: 2,
    details: [
      { label: "Reading POS export", meta: "3 files" },
      { label: "Scoring stockout risk", meta: "68%" },
    ],
  },
  {
    key: "draft",
    label: "Draft supplier emails",
    amount: "2 messages",
    status: "sequence",
    step: 3,
    details: [
      { label: "Cone supplier follow-up", meta: "draft" },
      { label: "Pistachio reorder note", meta: "draft" },
    ],
  },
];

export type TaskRowsProps = {
  variant?: TaskRowsVariant;
  rows?: TaskRow[];
  labels?: TaskRowsLabels;
  onToggleRow?: (key: string, open: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

export function TaskRows({
  variant = "Capsules",
  rows = DEFAULT_ROWS,
  labels,
  onToggleRow,
  style,
}: TaskRowsProps) {
  useTheme();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [seqPhase, setSeqPhase] = useState<"pending" | "failed" | "done">("pending");
  const copy = { completed: "Completed", failed: "Failed", running: "Running", ...labels };

  useEffect(() => {
    const t1 = setTimeout(() => setSeqPhase("failed"), 2400);
    const t2 = setTimeout(() => setSeqPhase("done"), 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  const isList = variant === "List";

  const resolveStatus = (row: TaskRow): "done" | "running" | "error" => {
    if (row.status !== "sequence") return row.status;
    if (seqPhase === "pending") return "running";
    if (seqPhase === "failed") return "error";
    return "done";
  };

  return (
    <View style={[isList ? styles.listContainer : styles.capsulesContainer, style]}>
      {rows.map((row, idx) => {
        const expanded = open[row.key] ?? false;
        const effective = resolveStatus(row);

        return (
          <View
            key={row.key}
            style={[
              isList ? styles.listItem : styles.capsuleItem,
              !isList && expanded && styles.capsuleExpanded,
              isList && idx < rows.length - 1 && styles.listBorder,
            ]}
          >
            <Pressable
              onPress={() => {
                const next = !expanded;
                setOpen((current) => ({ ...current, [row.key]: next }));
                onToggleRow?.(row.key, next);
              }}
              style={styles.row}
            >
              <View
                style={[
                  styles.statusCircle,
                  effective === "done" && styles.circleGreen,
                  effective === "error" && styles.circleRed,
                  effective === "running" && styles.circleRing,
                ]}
              >
                <Text style={styles.circleText}>
                  {effective === "done"
                    ? "✓"
                    : effective === "error"
                      ? "✕"
                      : String(row.step ?? idx + 1)}
                </Text>
              </View>

              <Text style={styles.label} numberOfLines={1}>
                {row.label}
              </Text>

              <Text style={styles.amount} numberOfLines={1}>
                {row.amount}
              </Text>

              {effective === "done" ? (
                <View style={styles.pillGreen}>
                  <Text style={styles.pillGreenText}>{copy.completed}</Text>
                </View>
              ) : effective === "error" ? (
                <View style={styles.pillRed}>
                  <Text style={styles.pillRedText}>{copy.failed} ↻</Text>
                </View>
              ) : null}

              <Text style={styles.chevron}>{expanded ? "▴" : "▾"}</Text>
            </Pressable>

            {expanded ? (
              <View style={styles.detailWrap}>
                <View style={styles.detailRail} />
                <View style={styles.detailRows}>
                  {row.details.map((detail) => (
                    <View key={detail.label} style={styles.detail}>
                      <Text style={styles.detailLabel}>{detail.label}</Text>
                      <Text style={styles.detailMeta}>{detail.meta}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export default TaskRows;

const styles = themedStyleSheet(() => ({
  capsulesContainer: {
    gap: 8,
  },
  listContainer: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    overflow: "hidden",
  },
  capsuleItem: {
    borderRadius: 22,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    overflow: "hidden",
  },
  capsuleExpanded: {
    borderRadius: 14,
  },
  listItem: {
    backgroundColor: theme.surfaceRaised,
  },
  listBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  row: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
  },
  statusCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  circleGreen: {
    backgroundColor: theme.green,
  },
  circleRed: {
    backgroundColor: theme.red,
  },
  circleRing: {
    borderWidth: 1.5,
    borderColor: theme.lineStrong,
    backgroundColor: theme.inset,
  },
  circleText: {
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  label: {
    flex: 1,
    color: theme.text,
    fontSize: 13,
    fontWeight: "500",
  },
  amount: {
    color: theme.ink2,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  pillGreen: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.greenTint,
  },
  pillGreenText: {
    color: theme.greenText,
    fontSize: 11,
    fontWeight: "600",
  },
  pillRed: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: theme.redTint,
  },
  pillRedText: {
    color: theme.redText,
    fontSize: 11,
    fontWeight: "600",
  },
  chevron: {
    color: theme.muted,
    fontSize: 11,
    paddingHorizontal: 2,
  },
  detailWrap: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 10,
  },
  detailRail: {
    width: 1.5,
    backgroundColor: theme.lineStrong,
    marginLeft: 10,
  },
  detailRows: {
    flex: 1,
    gap: 5,
  },
  detail: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    color: theme.ink2,
    fontSize: 12,
  },
  detailMeta: {
    color: theme.muted,
    fontSize: 11.5,
    fontVariant: ["tabular-nums"],
  },
}));
