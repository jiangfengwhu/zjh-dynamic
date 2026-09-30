import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Badge } from "../shadcn/Badge";
import { Button } from "../shadcn/Button";
import { Progress } from "../shadcn/Progress";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * RECOMMENDATION CARD
 * Agent suggestion with a confidence meter and actions.
 * ───────────────────────────────────────────────────────── */

export type RecommendationOption = {
  id: string;
  label: string;
  meta: string;
  confidence: number;
};

export type RecommendationCardProps = {
  title?: string;
  confidence?: number;
  rationale?: string;
  alternatives?: RecommendationOption[];
  onApply?: (optionId?: string) => void;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_ALTERNATIVES: RecommendationOption[] = [
  { id: "alt-1", label: "Split order: 6 cases Express + 6 Standard", meta: "Lead time 3d · +$42", confidence: 81 },
  { id: "alt-2", label: "Switch to Baltic Berry Wafer Co.", meta: "Lead time 5d · -$18", confidence: 74 },
];

export function RecommendationCard({
  title = "Reorder waffle cones from Cone King with lead time 7 days",
  confidence = 94,
  rationale = "Projected weekend scoop velocity depletes current safety stock by next Thursday.",
  alternatives = DEFAULT_ALTERNATIVES,
  onApply,
  style,
}: RecommendationCardProps) {
  useTheme();
  const [showOther, setShowOther] = useState(false);
  const [applied, setApplied] = useState(false);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Badge tone="accent">Recommended Action</Badge>
        <Text style={styles.confText}>{confidence}% confidence</Text>
      </View>

      <Progress value={confidence} color={theme.accent} style={styles.meter} />

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.rationale}>{rationale}</Text>

      <View style={styles.footer}>
        <Pressable
          onPress={() => setShowOther((v) => !v)}
          style={styles.otherToggle}
        >
          <Text style={styles.otherLabel}>
            Other options ({alternatives.length}) {showOther ? "▴" : "▾"}
          </Text>
        </Pressable>

        <Button
          variant={applied ? "secondary" : "default"}
          size="sm"
          label={applied ? "✓ Applied" : "Apply"}
          onPress={() => {
            setApplied(true);
            onApply?.();
          }}
        />
      </View>

      {showOther ? (
        <View style={styles.altList}>
          {alternatives.map((alt) => (
            <Pressable
              key={alt.id}
              onPress={() => {
                setApplied(true);
                onApply?.(alt.id);
              }}
              style={styles.altRow}
            >
              <View style={styles.altBody}>
                <Text style={styles.altTitle}>{alt.label}</Text>
                <Text style={styles.altMeta}>{alt.meta}</Text>
              </View>
              <Badge tone="outline">{alt.confidence}%</Badge>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  confText: {
    color: theme.accentText,
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  meter: {
    height: 4,
  },
  title: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  rationale: {
    color: theme.muted,
    fontSize: 12.5,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  otherToggle: {
    paddingVertical: 4,
  },
  otherLabel: {
    color: theme.ink2,
    fontSize: 12,
    fontWeight: "500",
  },
  altList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.line,
    paddingTop: 8,
    gap: 6,
  },
  altRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.inset,
  },
  altBody: {
    flex: 1,
    gap: 2,
  },
  altTitle: {
    color: theme.text,
    fontSize: 12.5,
    fontWeight: "500",
  },
  altMeta: {
    color: theme.muted,
    fontSize: 11.5,
  },
}));
