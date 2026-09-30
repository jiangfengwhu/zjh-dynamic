import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * CODE BLOCK
 * Variants:
 *   Code — a line-numbered listing with syntax coloring
 *   Diff — a unified diff: old/new gutters, green/red bar &
 *          row tint, plus word-level add/del highlights
 * ───────────────────────────────────────────────────────── */

export type CodeBlockVariant = "Code" | "Diff";

export type CodePiece = { text: string; change?: "add" | "del" };

export type DiffLineRow = {
  old: number | null;
  cur: number | null;
  type: "ctx" | "add" | "del";
  pieces: CodePiece[];
};

const DEFAULT_CODE_LINES = [
  "export async function churnBatch() {",
  '  const flavor = await getFlavor("pistachio");',
  "  const base = await dairy.fetch({ flavor });",
  '  await freezer.store(base, { temp: "-16C" });',
  "  if (!base.approved) return null;",
  "  return base.gallons;",
  "}",
];

const DEFAULT_DIFF_ROWS: DiffLineRow[] = [
  { old: 1, cur: 1, type: "ctx", pieces: [{ text: "export async function churnBatch() {" }] },
  { old: 2, cur: 2, type: "ctx", pieces: [{ text: '  const flavor = await getFlavor("pistachio");' }] },
  { old: 3, cur: 3, type: "ctx", pieces: [{ text: "  const base = await dairy.fetch({ flavor });" }] },
  {
    old: 4,
    cur: null,
    type: "del",
    pieces: [
      { text: "  await freezer.store(base, { temp: " },
      { text: '"-14C"', change: "del" },
      { text: " });" },
    ],
  },
  {
    old: null,
    cur: 4,
    type: "add",
    pieces: [
      { text: "  await freezer.store(base, { temp: " },
      { text: '"-16C"', change: "add" },
      { text: " });" },
    ],
  },
  { old: null, cur: 5, type: "add", pieces: [{ text: "  if (!base.approved) return null;" }] },
  { old: 5, cur: 6, type: "ctx", pieces: [{ text: "  return base.gallons;" }] },
  { old: 6, cur: 7, type: "ctx", pieces: [{ text: "}" }] },
];

export type CodeBlockProps = {
  variant?: CodeBlockVariant;
  filename?: string;
  lines?: string[];
  diff?: DiffLineRow[];
  style?: StyleProp<ViewStyle>;
};

export function CodeBlock({
  variant: initialVariant = "Code",
  filename = "churn.ts",
  lines = DEFAULT_CODE_LINES,
  diff = DEFAULT_DIFF_ROWS,
  style,
}: CodeBlockProps) {
  useTheme();
  const [mode, setMode] = useState<CodeBlockVariant>(initialVariant);
  const [copied, setCopied] = useState(false);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <View style={styles.fileGroup}>
          <Text style={styles.fileIcon}>⟨/⟩</Text>
          <Text style={styles.filename}>{filename}</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.modeToggle}>
            {(["Code", "Diff"] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setMode(v)}
                style={[styles.modeBtn, mode === v && styles.modeBtnActive]}
              >
                <Text style={[styles.modeText, mode === v && styles.modeTextActive]}>
                  {v}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            style={styles.copyBtn}
          >
            <Text style={styles.copyText}>{copied ? "✓ Copied" : "Copy"}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.codeArea}>
          {mode === "Code"
            ? lines.map((line, idx) => (
                <View key={idx} style={styles.lineRow}>
                  <Text style={styles.lineNo}>{idx + 1}</Text>
                  <Text style={styles.codeText}>{line}</Text>
                </View>
              ))
            : diff.map((row, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.lineRow,
                    row.type === "add" && styles.lineAdd,
                    row.type === "del" && styles.lineDel,
                  ]}
                >
                  <View
                    style={[
                      styles.diffAccentBar,
                      row.type === "add" && { backgroundColor: theme.green },
                      row.type === "del" && { backgroundColor: theme.red },
                    ]}
                  />
                  <Text style={styles.gutterNo}>{row.old ?? ""}</Text>
                  <Text style={styles.gutterNo}>{row.cur ?? ""}</Text>
                  <Text style={styles.diffSign}>
                    {row.type === "add" ? "+" : row.type === "del" ? "-" : " "}
                  </Text>
                  <Text style={styles.codeText}>
                    {row.pieces.map((p, pIdx) => (
                      <Text
                        key={pIdx}
                        style={[
                          p.change === "add" && styles.wordAdd,
                          p.change === "del" && styles.wordDel,
                        ]}
                      >
                        {p.text}
                      </Text>
                    ))}
                  </Text>
                </View>
              ))}
        </View>
      </ScrollView>
    </View>
  );
}

export default CodeBlock;

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
    paddingVertical: 8,
    backgroundColor: theme.inset,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  fileGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fileIcon: {
    color: theme.muted,
    fontSize: 12,
  },
  filename: {
    color: theme.ink1,
    fontSize: 12.5,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeToggle: {
    flexDirection: "row",
    backgroundColor: theme.surface,
    borderRadius: 6,
    padding: 2,
    gap: 2,
  },
  modeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 4,
  },
  modeBtnActive: {
    backgroundColor: theme.surfaceRaised,
  },
  modeText: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  modeTextActive: {
    color: theme.text,
    fontWeight: "600",
  },
  copyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  copyText: {
    color: theme.text,
    fontSize: 11,
    fontWeight: "500",
  },
  codeArea: {
    paddingVertical: 8,
    minWidth: "100%",
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 12,
    paddingVertical: 2.5,
  },
  lineAdd: {
    backgroundColor: theme.greenTint,
  },
  lineDel: {
    backgroundColor: theme.redTint,
  },
  diffAccentBar: {
    width: 3,
    alignSelf: "stretch",
    marginRight: 6,
  },
  lineNo: {
    width: 28,
    paddingLeft: 10,
    color: theme.ink3,
    fontSize: 11.5,
    fontVariant: ["tabular-nums"],
  },
  gutterNo: {
    width: 20,
    color: theme.ink3,
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    textAlign: "right",
    marginRight: 4,
  },
  diffSign: {
    width: 14,
    color: theme.muted,
    fontSize: 12,
    textAlign: "center",
  },
  codeText: {
    color: theme.ink2,
    fontSize: 12,
  },
  wordAdd: {
    backgroundColor: "rgba(34, 197, 94, 0.28)",
    color: theme.greenText,
    fontWeight: "600",
  },
  wordDel: {
    backgroundColor: "rgba(239, 68, 68, 0.28)",
    color: theme.redText,
    textDecorationLine: "line-through",
  },
}));
