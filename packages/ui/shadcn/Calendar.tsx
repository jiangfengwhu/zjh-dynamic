import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type CalendarMode = "single" | "range" | "multiple";

export type CalendarProps = {
  mode?: CalendarMode;
  selected?: Date;
  onSelect?: (date: Date) => void;
  style?: StyleProp<ViewStyle>;
};

export function Calendar({
  mode = "single",
  selected,
  onSelect,
  style,
}: CalendarProps) {
  useTheme();
  const initial = selected ?? new Date(2026, 8, 24);
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [pickedDay, setPickedDay] = useState<number>(initial.getDate());
  const [rangeEndDay, setRangeEndDay] = useState<number | null>(mode === "range" ? Math.min(28, initial.getDate() + 4) : null);

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const changeMonth = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  const handleDayPress = (day: number) => {
    if (mode === "range") {
      if (rangeEndDay !== null || day < pickedDay) {
        setPickedDay(day);
        setRangeEndDay(null);
      } else {
        setRangeEndDay(day);
      }
    } else {
      setPickedDay(day);
    }
    onSelect?.(new Date(viewYear, viewMonth, day));
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.header}>
        <Pressable onPress={() => changeMonth(-1)} style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={() => changeMonth(1)} style={styles.navBtn}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekText}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: firstWeekday }).map((_, idx) => (
          <View key={`empty-${idx}`} style={styles.dayCell} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const isSelected = day === pickedDay || day === rangeEndDay;
          const inRange =
            mode === "range" &&
            rangeEndDay !== null &&
            day > pickedDay &&
            day < rangeEndDay;

          return (
            <Pressable
              key={day}
              onPress={() => handleDayPress(day)}
              style={[
                styles.dayCell,
                inRange && styles.dayInRange,
                isSelected && styles.daySelected,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  (isSelected || inRange) && styles.dayTextSelected,
                ]}
              >
                {day}
              </Text>
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
    padding: 12,
    gap: 8,
    width: 268,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navBtn: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  navText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "600",
  },
  monthLabel: {
    color: theme.text,
    fontSize: 13.5,
    fontWeight: "600",
  },
  weekRow: {
    flexDirection: "row",
  },
  weekText: {
    flex: 1,
    textAlign: "center",
    color: theme.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.285%",
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.sm,
  },
  dayInRange: {
    backgroundColor: theme.inset,
    borderRadius: 0,
  },
  daySelected: {
    backgroundColor: theme.text,
  },
  dayText: {
    color: theme.ink1,
    fontSize: 12.5,
    fontVariant: ["tabular-nums"],
  },
  dayTextSelected: {
    color: theme.ink,
    fontWeight: "700",
  },
}));
