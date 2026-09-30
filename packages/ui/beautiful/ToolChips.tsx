import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * TOOL CHIPS
 * Code edits and tool calls as compact chips.
 * Every row expands to show what the tool actually did.
 * ───────────────────────────────────────────────────────── */

export type ToolDetailLine = { text: string; tone?: "add" | "del" };

export type ToolStep = {
  icon: string;
  label: string;
  chip: string;
  mono: boolean;
  detail: ToolDetailLine[];
  state?: "running" | "done" | "error";
};

const DEFAULT_STEPS: ToolStep[] = [
  {
    icon: "edit",
    label: "Edited churnBatch.ts",
    chip: "+6 -2",
    mono: true,
    state: "done",
    detail: [
      { text: "- const targetTemp = -12;", tone: "del" },
      { text: "+ const targetTemp = -16;", tone: "add" },
    ],
  },
  {
    icon: "sql",
    label: "Queried flavor_velocity",
    chip: "42ms",
    mono: true,
    state: "done",
    detail: [{ text: "SELECT flavor, weekly_scoops FROM sales WHERE q = 'Q4'" }],
  },
];

export type ToolChipsProps = {
  steps?: ToolStep[];
  labels?: { header?: string };
  style?: StyleProp<ViewStyle>;
};

export function ToolChips({ steps = DEFAULT_STEPS, labels, style }: ToolChipsProps) {
  useTheme();
  const [open, setOpen] = useState(true);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});
  const header = labels?.header ?? `${steps.length} tool calls`;

  return (
    <View style={style}>
      <Pressable onPress={() => setOpen((value) => !value)} style={styles.header}>
        <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
        <Text style={styles.headerLabel}>{header}</Text>
      </Pressable>
      {open
        ? steps.map((row) => {
            const rowOpen = openRows[row.label] ?? false;
            return (
              <View key={row.label}>
                <Pressable
                  onPress={() =>
                    setOpenRows((current) => ({ ...current, [row.label]: !rowOpen }))
                  }
                  style={styles.row}
                >
                  <Text style={styles.icon}>
                    {row.state === "done" ? "✓" : row.state === "error" ? "!" : "•"}
                  </Text>
                  <Text style={styles.label}>{row.label}</Text>
                  <View style={styles.chip}>
                    <Text
                      style={[styles.chipText, row.mono && styles.mono]}
                      numberOfLines={1}
                    >
                      {row.chip}
                    </Text>
                  </View>
                </Pressable>
                {rowOpen
                  ? row.detail.map((line, i) => (
                      <Text
                        key={`${line.text}-${i}`}
                        style={[
                          styles.detail,
                          line.tone === "add" && styles.add,
                          line.tone === "del" && styles.del,
                        ]}
                      >
                        {line.text}
                      </Text>
                    ))
                  : null}
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  header: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  chevron: { color: theme.muted, fontSize: 12 },
  headerLabel: { color: theme.muted, fontSize: 12, fontWeight: "500" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28 },
  icon: { color: theme.muted, width: 14, fontSize: 12 },
  label: { color: theme.text, fontSize: 13 },
  chip: {
    flexShrink: 1,
    borderRadius: 6,
    backgroundColor: theme.inset,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  chipText: { color: theme.ink2, fontSize: 11.5 },
  mono: { fontVariant: ["tabular-nums"] },
  detail: { color: theme.muted, fontSize: 12, paddingLeft: 22, paddingVertical: 2 },
  add: { color: theme.greenText },
  del: { color: theme.redText },
}));
