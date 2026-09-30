import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Badge } from "../shadcn/Badge";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * CONTEXT CARDS
 * Retrieved knowledge chunks with their sources.
 * ───────────────────────────────────────────────────────── */

export type ContextChunk = {
  id: string;
  source: string;
  section: string;
  score: string;
  excerpt: string;
};

const DEFAULT_CHUNKS: ContextChunk[] = [
  {
    id: "c1",
    source: "SOP-Dairy-04.pdf",
    section: "§2.1 Cold-Chain Onboarding",
    score: "0.96",
    excerpt:
      "Cold-chain certification must be verified before a new dairy can be added to the reorder workflow.",
  },
  {
    id: "c2",
    source: "Q4_Velocity_Report.csv",
    section: "Row 14–22 · Weekly Scoops",
    score: "0.91",
    excerpt:
      "Q4 velocity table: pistachio +18%, vanilla +6%, rocky road -11%; retire flavors below 40 scoops weekly.",
  },
];

export type ContextCardsProps = {
  chunks?: ContextChunk[];
  style?: StyleProp<ViewStyle>;
};

export function ContextCards({ chunks = DEFAULT_CHUNKS, style }: ContextCardsProps) {
  useTheme();
  const [activeId, setActiveId] = useState<string | null>(chunks[0]?.id ?? null);

  return (
    <View style={[styles.list, style]}>
      {chunks.map((chunk) => {
        const expanded = activeId === chunk.id;
        return (
          <Pressable
            key={chunk.id}
            onPress={() => setActiveId(expanded ? null : chunk.id)}
            style={[styles.card, expanded && styles.cardActive]}
          >
            <View style={styles.topRow}>
              <Text style={styles.source}>{chunk.source}</Text>
              <Badge tone="outline">{chunk.score}</Badge>
            </View>
            <Text style={styles.section}>{chunk.section}</Text>
            <Text
              style={styles.excerpt}
              numberOfLines={expanded ? undefined : 2}
            >
              “{chunk.excerpt}”
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  list: {
    gap: 8,
  },
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    padding: 12,
    gap: 4,
  },
  cardActive: {
    borderColor: theme.lineStrong,
    backgroundColor: theme.inset,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  source: {
    color: theme.text,
    fontSize: 12.5,
    fontWeight: "600",
  },
  section: {
    color: theme.muted,
    fontSize: 11.5,
  },
  excerpt: {
    color: theme.ink2,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 2,
  },
}));
