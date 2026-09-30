import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type ChartDataPoint = {
  label: string;
  value: number;
  secondary?: number;
};

export type ChartConfig = Record<
  string,
  { label: string; color: string }
>;

export type ChartContainerProps = {
  config?: ChartConfig;
  title?: string;
  description?: string;
  data?: ChartDataPoint[];
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

const DEFAULT_DATA: ChartDataPoint[] = [
  { label: "Mon", value: 48, secondary: 32 },
  { label: "Tue", value: 64, secondary: 41 },
  { label: "Wed", value: 58, secondary: 49 },
  { label: "Thu", value: 82, secondary: 56 },
  { label: "Fri", value: 94, secondary: 68 },
  { label: "Sat", value: 112, secondary: 79 },
];

export function ChartContainer({
  title,
  description,
  data = DEFAULT_DATA,
  children,
  style,
}: ChartContainerProps) {
  useTheme();
  const [activeIdx, setActiveIdx] = useState<number>(data.length - 1);
  const maxVal = Math.max(...data.map((d) => Math.max(d.value, d.secondary ?? 0)), 1);
  const activePoint = data[activeIdx] ?? data[0];

  return (
    <View style={[styles.card, style]}>
      {title || description ? (
        <View style={styles.header}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {description ? <Text style={styles.desc}>{description}</Text> : null}
        </View>
      ) : null}

      {activePoint ? (
        <ChartTooltip
          label={activePoint.label}
          value={activePoint.value}
          secondary={activePoint.secondary}
        />
      ) : null}

      {children ?? (
        <View style={styles.barsRow}>
          {data.map((pt, idx) => {
            const h1 = Math.round((pt.value / maxVal) * 100);
            const h2 = pt.secondary !== undefined ? Math.round((pt.secondary / maxVal) * 100) : null;
            const selected = idx === activeIdx;
            return (
              <Pressable
                key={pt.label}
                onPress={() => setActiveIdx(idx)}
                style={styles.col}
              >
                <View style={styles.barPair}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: `${h1}%`,
                        backgroundColor: selected ? theme.accent : theme.text,
                      },
                    ]}
                  />
                  {h2 !== null ? (
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${h2}%`,
                          backgroundColor: theme.lineStrong,
                        },
                      ]}
                    />
                  ) : null}
                </View>
                <Text style={[styles.axisLabel, selected && styles.axisLabelActive]}>
                  {pt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function ChartTooltip({
  label,
  value,
  secondary,
}: {
  label: string;
  value: number;
  secondary?: number;
}) {
  useTheme();
  return (
    <View style={styles.tooltip}>
      <Text style={styles.tooltipLabel}>{label}</Text>
      <Text style={styles.tooltipVal}>Primary: {value}</Text>
      {secondary !== undefined ? (
        <Text style={styles.tooltipSub}>Baseline: {secondary}</Text>
      ) : null}
    </View>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  useTheme();
  return (
    <View style={styles.legend}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: it.color }]} />
          <Text style={styles.legendText}>{it.label}</Text>
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
    padding: 14,
    gap: 10,
  },
  header: {
    gap: 2,
  },
  title: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  desc: {
    color: theme.muted,
    fontSize: 12,
  },
  tooltip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.inset,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tooltipLabel: {
    color: theme.text,
    fontSize: 12,
    fontWeight: "600",
  },
  tooltipVal: {
    color: theme.accentText,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  tooltipSub: {
    color: theme.muted,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  barsRow: {
    height: 110,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingTop: 10,
  },
  col: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  barPair: {
    flex: 1,
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
  },
  bar: {
    width: 10,
    borderRadius: 3,
    minHeight: 4,
  },
  axisLabel: {
    color: theme.muted,
    fontSize: 10.5,
  },
  axisLabelActive: {
    color: theme.text,
    fontWeight: "600",
  },
  legend: {
    flexDirection: "row",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: theme.ink2,
    fontSize: 11.5,
  },
}));
