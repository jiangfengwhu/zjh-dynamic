import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Slider } from "../shadcn/Slider";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * FINE-TUNE CARD
 * The agent adjusts design properties in an inspector.
 * ───────────────────────────────────────────────────────── */

export type FineTuneCardProps = {
  initialPadding?: number;
  initialGap?: number;
  initialRadius?: number;
  style?: StyleProp<ViewStyle>;
};

export function FineTuneCard({
  initialPadding = 16,
  initialGap = 10,
  initialRadius = 12,
  style,
}: FineTuneCardProps) {
  useTheme();
  const [padding, setPadding] = useState(initialPadding);
  const [gap, setGap] = useState(initialGap);
  const [radius, setRadius] = useState(initialRadius);
  const [align, setAlign] = useState<"flex-start" | "center" | "space-between">("space-between");

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>Layout Inspector</Text>
        <Text style={styles.badge}>Agent Tuned</Text>
      </View>

      <View
        style={[
          styles.previewBox,
          {
            padding,
            gap,
            borderRadius: radius,
            justifyContent: align,
          },
        ]}
      >
        <View style={[styles.swatch, { borderRadius: Math.max(4, radius - 4) }]} />
        <View style={styles.previewLines}>
          <View style={styles.linePrimary} />
          <View style={styles.lineSecondary} />
        </View>
        <View style={styles.pill} />
      </View>

      <View style={styles.controls}>
        <Slider
          label="Padding"
          unit="px"
          min={6}
          max={28}
          value={padding}
          onValueChange={setPadding}
        />
        <Slider
          label="Gap"
          unit="px"
          min={4}
          max={24}
          value={gap}
          onValueChange={setGap}
        />
        <Slider
          label="Radius"
          unit="px"
          min={0}
          max={24}
          value={radius}
          onValueChange={setRadius}
        />

        <View style={styles.alignRow}>
          <Text style={styles.alignLabel}>Distribution</Text>
          <View style={styles.segmented}>
            {(
              [
                { key: "flex-start", label: "Start" },
                { key: "center", label: "Center" },
                { key: "space-between", label: "Between" },
              ] as const
            ).map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => setAlign(opt.key)}
                style={[styles.segBtn, align === opt.key && styles.segBtnActive]}
              >
                <Text
                  style={[
                    styles.segText,
                    align === opt.key && styles.segTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: theme.text,
    fontSize: 13.5,
    fontWeight: "600",
  },
  badge: {
    color: theme.accentText,
    fontSize: 11,
    fontWeight: "600",
  },
  previewBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  swatch: {
    width: 28,
    height: 28,
    backgroundColor: theme.accent,
  },
  previewLines: {
    flex: 1,
    gap: 5,
  },
  linePrimary: {
    width: "65%",
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.ink1,
  },
  lineSecondary: {
    width: "42%",
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.ink3,
  },
  pill: {
    width: 36,
    height: 18,
    borderRadius: 999,
    backgroundColor: theme.surfaceRaised,
  },
  controls: {
    gap: 10,
  },
  alignRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alignLabel: {
    color: theme.ink2,
    fontSize: 12,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: theme.inset,
    borderRadius: theme.radius.sm,
    padding: 2,
    gap: 2,
  },
  segBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  segBtnActive: {
    backgroundColor: theme.surfaceRaised,
  },
  segText: {
    color: theme.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  segTextActive: {
    color: theme.text,
    fontWeight: "600",
  },
}));
