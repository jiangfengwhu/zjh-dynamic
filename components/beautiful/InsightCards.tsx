import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Badge } from "../shadcn/Badge";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * INSIGHT CARDS
 * Paged agent insights with scrub-ready live charts.
 * ───────────────────────────────────────────────────────── */

export type InsightSlide = {
  id: string;
  headline: string;
  pctDelta: string;
  usdDelta: string;
  positive?: boolean;
  bars: number[];
};

const DEFAULT_INSIGHTS: InsightSlide[] = [
  {
    id: "i1",
    headline:
      "The worst performer in your @Creamery is Rocky Road — down -6% or -$2,453.44.",
    pctDelta: "-6%",
    usdDelta: "-$2,453.44",
    positive: false,
    bars: [78, 72, 65, 59, 52, 48, 41],
  },
  {
    id: "i2",
    headline:
      "Pistachio weekend scoops surged +23% in @Creamery, adding +$3,617.22 net margin.",
    pctDelta: "+23%",
    usdDelta: "+$3,617.22",
    positive: true,
    bars: [42, 49, 55, 63, 74, 88, 96],
  },
];

export type InsightCardsProps = {
  insights?: InsightSlide[];
  style?: StyleProp<ViewStyle>;
};

export function InsightCards({ insights = DEFAULT_INSIGHTS, style }: InsightCardsProps) {
  useTheme();
  const [page, setPage] = useState(0);
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const item = insights[page] ?? insights[0];

  return (
    <View style={[styles.card, style]}>
      <View style={styles.topRow}>
        <Badge tone={item.positive ? "success" : "danger"}>{item.pctDelta}</Badge>
        <Badge tone="outline">{item.usdDelta}</Badge>
        <View style={styles.pager}>
          {insights.map((slide, idx) => (
            <Pressable
              key={slide.id}
              onPress={() => {
                setPage(idx);
                setScrubIndex(null);
              }}
              style={[styles.dot, idx === page && styles.dotActive]}
            />
          ))}
        </View>
      </View>

      <Text style={styles.headline}>{item.headline}</Text>

      <View style={styles.chart}>
        {item.bars.map((val, idx) => {
          const active = scrubIndex === idx || (scrubIndex === null && idx === item.bars.length - 1);
          return (
            <Pressable
              key={idx}
              onPress={() => setScrubIndex(idx)}
              style={styles.barSlot}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: `${val}%`,
                    backgroundColor: active
                      ? item.positive
                        ? theme.green
                        : theme.red
                      : theme.lineStrong,
                  },
                ]}
              />
              <Text style={styles.dayLabel}>D{idx + 1}</Text>
            </Pressable>
          );
        })}
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
    padding: 14,
    gap: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pager: {
    marginLeft: "auto",
    flexDirection: "row",
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.lineStrong,
  },
  dotActive: {
    backgroundColor: theme.text,
    width: 16,
  },
  headline: {
    color: theme.text,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: "500",
  },
  chart: {
    height: 92,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.inset,
    paddingBottom: 6,
  },
  barSlot: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  bar: {
    width: "70%",
    borderRadius: 4,
    minHeight: 6,
  },
  dayLabel: {
    color: theme.muted,
    fontSize: 9.5,
    fontVariant: ["tabular-nums"],
  },
}));
