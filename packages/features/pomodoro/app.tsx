import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Svg, Circle } from "react-native-svg";
import { BackChip, Icon, Pressy } from "@zijinhua/app-sdk/ui";
import { themedStyleSheet, useTheme } from "@zijinhua/app-sdk/ui";
import { getAppContext } from "@zijinhua/app-sdk";
import { readPomodoroStats, subscribePomodoroStats, addPomodoroFlower, type PomodoroStats } from "./storage";
const phone = getAppContext().phone;
const publishFeedPost = getAppContext().feed.publish;

const FOCUS_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;

type TimerMode = "idle" | "focus" | "break";

function askShell(request: { action: "back" }) {
  getAppContext().navigation.back();
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function PomodoroApp() {
  const { colors } = useTheme();
  const [stats, setStats] = useState<PomodoroStats>(() => readPomodoroStats());
  const [mode, setMode] = useState<TimerMode>("idle");
  const [timeLeft, setTimeLeft] = useState(FOCUS_DURATION);

  useEffect(() => subscribePomodoroStats(setStats), []);

  const handleTimerEnd = useCallback(() => {
    if (mode === "focus") {
      addPomodoroFlower();
      publishFeedPost({
        kind: "update",
        body: "刚刚完成了一次 25 分钟的专注，获得了一朵小花！",
      });
      phone.speak("专注结束，休息一下吧。");
      phone.vibrate(500);
      setMode("break");
      setTimeLeft(BREAK_DURATION);
    } else if (mode === "break") {
      phone.speak("休息结束，准备开始新的专注。");
      phone.vibrate(500);
      setMode("idle");
      setTimeLeft(FOCUS_DURATION);
    }
  }, [mode]);

  useEffect(() => {
    if (mode === "idle") return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [mode]);

  useEffect(() => {
    if (mode !== "idle" && timeLeft === 0) {
      handleTimerEnd();
    }
  }, [timeLeft, mode, handleTimerEnd]);

  const toggleTimer = () => {
    if (mode === "idle") {
      setMode("focus");
      setTimeLeft(FOCUS_DURATION);
    } else if (mode === "focus" || mode === "break") {
      // Pause or stop? Let's just reset for simplicity if clicked while running.
      setMode("idle");
      setTimeLeft(FOCUS_DURATION);
    }
  };

  const skipBreak = () => {
    setMode("idle");
    setTimeLeft(FOCUS_DURATION);
  };

  const totalDuration = mode === "break" ? BREAK_DURATION : FOCUS_DURATION;
  const progress = mode === "idle" ? 1 : timeLeft / totalDuration;

  const size = 280;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <View style={styles.bar}>
        <BackChip onPress={() => askShell({ action: "back" })} />
        <View style={styles.barCopy}>
          <Text style={[styles.barTitle, { color: colors.ink1 }]}>番茄钟</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.statsContainer}>
          <View style={[styles.flowerPill, { backgroundColor: colors.orangeTint, borderColor: colors.orange }]}>
            <Icon name="sun" size={16} color={colors.orangeText} />
            <Text style={[styles.flowerText, { color: colors.orangeText }]}>
              今日小花: {stats.flowers}
            </Text>
          </View>
        </View>

        <View style={styles.timerContainer}>
          <View style={styles.ringWrapper}>
            <Svg width={size} height={size}>
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={colors.inset}
                strokeWidth={strokeWidth}
                fill="none"
              />
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={mode === "break" ? colors.green : colors.orange}
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                rotation="-90"
                originX={size / 2}
                originY={size / 2}
              />
            </Svg>
            <View style={styles.timeWrapper}>
              <Text style={[styles.timeText, { color: colors.ink1, fontFamily: colors.mono }]}>
                {formatTime(timeLeft)}
              </Text>
              <Text style={[styles.modeText, { color: colors.ink3 }]}>
                {mode === "idle" ? "准备专注" : mode === "focus" ? "专注中" : "休息中"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.controls}>
          <Pressy
            accessibilityRole="button"
            onPress={toggleTimer}
            scale={0.95}
            style={[
              styles.actionButton,
              { backgroundColor: mode === "idle" ? colors.orange : colors.surfaceRaised }
            ]}
          >
            <Icon
              name={mode === "idle" ? "sun" : "stop"}
              size={24}
              color={mode === "idle" ? colors.onAccent : colors.ink1}
            />
            <Text style={[
              styles.actionText,
              { color: mode === "idle" ? colors.onAccent : colors.ink1 }
            ]}>
              {mode === "idle" ? "开始专注" : "停止"}
            </Text>
          </Pressy>

          {mode === "break" && (
            <Pressy
              accessibilityRole="button"
              onPress={skipBreak}
              scale={0.95}
              style={[styles.skipButton, { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.skipText, { color: colors.ink2 }]}>跳过休息</Text>
            </Pressy>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = themedStyleSheet((t) => ({
  screen: {
    flex: 1,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  barCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  barTitle: {
    fontFamily: t.serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  statsContainer: {
    alignItems: "center",
  },
  flowerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  flowerText: {
    fontSize: 15,
    fontWeight: "600",
  },
  timerContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  ringWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  timeWrapper: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: 64,
    fontWeight: "700",
    lineHeight: 76,
  },
  modeText: {
    fontSize: 16,
    marginTop: 8,
    fontWeight: "500",
  },
  controls: {
    alignItems: "center",
    gap: 16,
    minHeight: 120,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: 200,
    height: 56,
    borderRadius: 28,
  },
  actionText: {
    fontSize: 18,
    fontWeight: "600",
  },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  skipText: {
    fontSize: 14,
    fontWeight: "500",
  },
}));

export default PomodoroApp;
