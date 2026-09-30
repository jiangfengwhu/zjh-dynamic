import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Shimmer } from "./atoms/Shimmer";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * LOADING STATE — pixel-grid loader for long-running work
 *
 * Variants:
 *   Drive  — square cells, chevron wavefront driving right (650ms cycle)
 *   Dots   — same wavefront, circular cells
 *   Orbit  — a comet lapping the 3x3 grid perimeter (950ms cycle)
 *   Surfer — the Drive loader paired with a distraction video preview below
 * ───────────────────────────────────────────────────────── */

export type LoadingStateVariant = "Drive" | "Dots" | "Orbit" | "Surfer";

const CHEVRON_STEPS = [
  [0, 3, 6],
  [1, 3, 4, 7],
  [2, 4, 5, 8],
  [5, 8, 1],
];

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];

export type LoadingStateProps = {
  label?: string;
  sublabel?: string;
  variant?: LoadingStateVariant;
  running?: boolean;
  initialSeconds?: number;
  videoSrc?: string;
  style?: StyleProp<ViewStyle>;
};

export function LoadingState({
  label,
  sublabel,
  variant = "Drive",
  running = true,
  initialSeconds = 0,
  style,
}: LoadingStateProps) {
  useTheme();
  const [step, setStep] = useState(0);
  const [ds, setDs] = useState(Math.round(initialSeconds * 10));

  const isSurfer = variant === "Surfer";
  const isDots = variant === "Dots";
  const isOrbit = variant === "Orbit";
  const resolvedLabel = label ?? (isSurfer ? "Subway surfing" : "Churning");

  useEffect(() => {
    if (!running) return;
    const intervalMs = isOrbit ? 120 : 160;
    const gridTimer = setInterval(
      () => setStep((s) => (s + 1) % (isOrbit ? ORBIT_ORDER.length : CHEVRON_STEPS.length)),
      intervalMs,
    );
    const clockTimer = setInterval(() => setDs((d) => d + 1), 100);
    return () => {
      clearInterval(gridTimer);
      clearInterval(clockTimer);
    };
  }, [running, isOrbit]);

  const totalSec = ds / 10;
  const elapsedText =
    totalSec < 60
      ? `${totalSec.toFixed(1)}s`
      : `${Math.floor(totalSec / 60)}m ${(totalSec % 60).toFixed(1)}s`;

  const renderGrid = () => (
    <View style={styles.grid3x3}>
      {Array.from({ length: 9 }).map((_, idx) => {
        let opacity = 0.15;
        if (isOrbit) {
          const orbitPos = ORBIT_ORDER.indexOf(idx);
          if (orbitPos === -1) {
            opacity = 0.07;
          } else {
            const diff = (step - orbitPos + ORBIT_ORDER.length) % ORBIT_ORDER.length;
            opacity = diff === 0 ? 1 : diff === 1 ? 0.65 : diff === 2 ? 0.35 : 0.15;
          }
        } else {
          const activeCells = CHEVRON_STEPS[step % CHEVRON_STEPS.length] ?? [];
          opacity = activeCells.includes(idx) ? 1 : 0.18;
        }
        return (
          <View
            key={idx}
            style={[
              styles.cell,
              isDots ? styles.cellRound : styles.cellSquare,
              { opacity },
            ]}
          />
        );
      })}
    </View>
  );

  return (
    <View style={[styles.root, style]}>
      <View style={styles.row}>
        {renderGrid()}
        <Shimmer active={running} style={styles.label}>
          {resolvedLabel}
        </Shimmer>
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
        <Text style={styles.elapsed}>{elapsedText}</Text>
      </View>

      {isSurfer ? (
        <View style={styles.surferCard}>
          <View style={styles.surferViewport}>
            {renderGrid()}
            <Text style={styles.surferText}>Subway Surfers Feed · 20fps</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export default LoadingState;

const styles = themedStyleSheet(() => ({
  root: {
    alignSelf: "flex-start",
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  grid3x3: {
    width: 15,
    height: 15,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 1.5,
  },
  cell: {
    width: 4,
    height: 4,
    backgroundColor: theme.text,
  },
  cellSquare: {
    borderRadius: 1,
  },
  cellRound: {
    borderRadius: 999,
  },
  label: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "500",
  },
  sublabel: {
    color: theme.muted,
    fontSize: 11.5,
  },
  elapsed: {
    color: theme.ink3,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  surferCard: {
    width: 224,
    height: 126,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  surferViewport: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  surferText: {
    color: theme.muted,
    fontSize: 10.5,
    fontVariant: ["tabular-nums"],
  },
}));
