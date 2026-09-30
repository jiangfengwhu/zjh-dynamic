import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * SELECTION ACTIONS
 * Highlight a passage and hand it to the agent to rewrite.
 * ───────────────────────────────────────────────────────── */

const REWRITES: Record<string, string> = {
  Original:
    "Pistachio holds the top slot all weekend. Churn it first thing Saturday so the batch has time to firm up before the afternoon rush.",
  Concise:
    "Pistachio leads weekend sales — churn Saturday AM to firm up before peak hours.",
  Executive:
    "Action Required: Schedule Pistachio batch production at 06:00 Saturday to capture +23% weekend demand surge.",
  Casual:
    "Pistachio is flying off the scoops! Spin a fresh batch Saturday morning so it's extra creamy by afternoon.",
};

export type SelectionActionsProps = {
  passage?: string;
  onApplyRewrite?: (nextText: string, mode: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function SelectionActions({
  passage,
  onApplyRewrite,
  style,
}: SelectionActionsProps) {
  useTheme();
  const [mode, setMode] = useState<keyof typeof REWRITES>("Original");
  const currentText = mode === "Original" && passage ? passage : REWRITES[mode];

  return (
    <View style={[styles.card, style]}>
      <View style={styles.toolbar}>
        {(Object.keys(REWRITES) as Array<keyof typeof REWRITES>).map((key) => {
          const active = key === mode;
          return (
            <Pressable
              key={key}
              onPress={() => {
                setMode(key);
                onApplyRewrite?.(REWRITES[key], key);
              }}
              style={[styles.actionBtn, active && styles.actionBtnActive]}
            >
              <Text style={[styles.actionText, active && styles.actionTextActive]}>
                {key === "Original" ? "✦ Original" : key}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.passageBox}>
        <View style={styles.highlightBar} />
        <Text style={styles.passageText}>{currentText}</Text>
      </View>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    padding: 12,
    gap: 10,
  },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: theme.inset,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 3,
  },
  actionBtn: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: theme.radius.sm,
  },
  actionBtnActive: {
    backgroundColor: theme.surfaceRaised,
  },
  actionText: {
    color: theme.muted,
    fontSize: 11.5,
    fontWeight: "500",
  },
  actionTextActive: {
    color: theme.text,
    fontWeight: "600",
  },
  passageBox: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: theme.accentTint,
    borderRadius: theme.radius.md,
    padding: 10,
  },
  highlightBar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: theme.accent,
  },
  passageText: {
    flex: 1,
    color: theme.text,
    fontSize: 13,
    lineHeight: 19,
  },
}));
