import { useEffect, useState } from "react";
import { ScrollView, Text, View, StyleSheet } from "react-native";
import { BackChip, Icon, Pressy, Surface, SectionTitle } from "../../ui/chrome";
import { themedStyleSheet, useTheme } from "../../ui/theme";
import { writePackageValue } from "../../ui/packageLink";
import { registerFeature } from "../src/featureHost";
import { type HabitData, readHabitData, subscribeHabitData, writeHabitData, getTodayStr } from "./storage";

function askShell(request: { action: "back" }) {
  writePackageValue("shell.nav.request", JSON.stringify({ ...request, at: Date.now() }));
}

const WATER_GOAL = 8;
const ALL_STICKERS = ["💧", "🌙", "🌟", "🎉", "🔥", "🍀", "🌻", "🍎"];

function HabitApp() {
  const { colors } = useTheme();
  const [data, setData] = useState<HabitData>(() => readHabitData());

  useEffect(() => subscribeHabitData(setData), []);

  const today = getTodayStr();
  const isCheckedIn = data.lastCheckIn === today;
  const isSleepDone = data.sleepDate === today;

  const handleCheckIn = () => {
    if (isCheckedIn) return;
    const newData = { ...data, lastCheckIn: today, streak: data.streak + 1 };
    if (newData.streak % 7 === 0 && newData.streak > 0) {
       newData.stickers = [...newData.stickers, "🌟"]; // Earn a star sticker for 7 days
    }
    writeHabitData(newData);
  };

  const handleWater = (delta: number) => {
    const newCount = Math.max(0, Math.min(WATER_GOAL, data.waterCount + delta));
    if (newCount === data.waterCount) return;
    const newData = { ...data, waterCount: newCount };
    if (newCount === WATER_GOAL && data.waterCount < WATER_GOAL) {
      newData.stickers = [...newData.stickers, "💧"]; // Earn water sticker
    }
    writeHabitData(newData);
  };

  const handleSleep = () => {
    if (isSleepDone) return;
    const newData = { ...data, sleepDate: today };
    newData.stickers = [...newData.stickers, "🌙"]; // Earn sleep sticker
    writeHabitData(newData);
  };

  const streakDays = data.streak % 7;
  // If streak is multiple of 7 and last check in is today, it's 7 days checked.
  const displayDays = (data.streak > 0 && streakDays === 0 && isCheckedIn) ? 7 : streakDays;

  return (
    <View style={[styles.screen, { backgroundColor: colors.canvas }]}>
      <View style={styles.bar}>
        <BackChip onPress={() => askShell({ action: "back" })} />
        <View style={styles.barCopy}>
          <Text style={[styles.barTitle, { color: colors.ink1 }]}>习惯打卡</Text>
          <Text style={[styles.barCaption, { color: colors.ink3 }]}>温馨可爱的日常小目标</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <View style={styles.block}>
          <SectionTitle>7日打卡连胜</SectionTitle>
          <Surface tone="base" style={styles.card}>
            <View style={styles.streakHeader}>
              <Text style={[styles.streakText, { color: colors.ink1 }]}>
                当前连胜 <Text style={{ color: colors.orange, fontWeight: 'bold' }}>{data.streak}</Text> 天
              </Text>
              {!isCheckedIn ? (
                <Pressy
                  accessibilityRole="button"
                  onPress={handleCheckIn}
                  style={[styles.checkInBtn, { backgroundColor: colors.orange }]}
                >
                  <Text style={[styles.checkInBtnText, { color: "#FFF" }]}>今日打卡</Text>
                </Pressy>
              ) : (
                <View style={[styles.checkedInBadge, { backgroundColor: colors.orangeTint }]}>
                  <Icon name="check" size={14} color={colors.orangeText} />
                  <Text style={[styles.checkedInText, { color: colors.orangeText }]}>已打卡</Text>
                </View>
              )}
            </View>
            <View style={styles.streakDots}>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => {
                const checked = i < displayDays;
                return (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: checked ? colors.orange : colors.inset,
                        borderColor: checked ? colors.orange : colors.line
                      }
                    ]}
                  >
                    {checked && <Icon name="sun" size={16} color="#FFF" />}
                  </View>
                );
              })}
            </View>
          </Surface>
        </View>

        <View style={styles.block}>
          <SectionTitle>今日小目标</SectionTitle>
          <Surface tone="raised" style={styles.card}>

            {/* 喝水 */}
            <View style={styles.goalRow}>
              <View style={styles.goalInfo}>
                <View style={[styles.iconBox, { backgroundColor: colors.cyanTint }]}>
                  <Icon name="cloud" size={18} color={colors.cyanText} />
                </View>
                <View>
                  <Text style={[styles.goalTitle, { color: colors.ink1 }]}>喝水</Text>
                  <Text style={[styles.goalSub, { color: colors.ink3 }]}>{data.waterCount} / {WATER_GOAL} 杯</Text>
                </View>
              </View>
              <View style={styles.waterControls}>
                <Pressy onPress={() => handleWater(-1)} style={[styles.waterBtn, { backgroundColor: colors.surface, borderColor: colors.line }]}>
                  <Text style={[styles.waterBtnText, { color: colors.ink1 }]}>-</Text>
                </Pressy>
                <Pressy onPress={() => handleWater(1)} style={[styles.waterBtn, { backgroundColor: colors.cyan }]}>
                  <Icon name="plus" size={16} color="#FFF" />
                </Pressy>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.line }]} />

            {/* 早睡 */}
            <View style={styles.goalRow}>
              <View style={styles.goalInfo}>
                <View style={[styles.iconBox, { backgroundColor: colors.orchidTint }]}>
                  <Icon name="moon" size={18} color={colors.orchidText} />
                </View>
                <View>
                  <Text style={[styles.goalTitle, { color: colors.ink1 }]}>早睡</Text>
                  <Text style={[styles.goalSub, { color: colors.ink3 }]}>保持良好作息</Text>
                </View>
              </View>
              <Pressy
                onPress={handleSleep}
                style={[
                  styles.sleepBtn,
                  { backgroundColor: isSleepDone ? colors.orchidTint : colors.orchid }
                ]}
              >
                <Text style={[
                  styles.sleepBtnText,
                  { color: isSleepDone ? colors.orchidText : "#FFF" }
                ]}>
                  {isSleepDone ? "已就寝" : "去睡觉"}
                </Text>
              </Pressy>
            </View>

          </Surface>
        </View>

        <View style={styles.block}>
          <SectionTitle>鼓励贴纸</SectionTitle>
          <Surface tone="inset" style={styles.stickerBoard}>
            {data.stickers.length === 0 ? (
              <Text style={[styles.emptySticker, { color: colors.ink3 }]}>完成目标来获得贴纸吧！</Text>
            ) : (
              <View style={styles.stickerGrid}>
                {data.stickers.map((sticker, idx) => (
                  <View key={idx} style={[styles.stickerWrap, { backgroundColor: colors.surface }]}>
                    <Text style={styles.stickerEmoji}>{sticker}</Text>
                  </View>
                ))}
              </View>
            )}
          </Surface>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = themedStyleSheet((t) => ({
  screen: { flex: 1 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  barCopy: { flex: 1, minWidth: 0, gap: 1 },
  barTitle: { fontFamily: t.serif, fontSize: 22, lineHeight: 28, fontWeight: "700" },
  barCaption: { fontSize: 12.5, lineHeight: 17 },
  content: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 36, gap: 20 },
  block: { gap: 8 },
  card: { padding: 16, gap: 12 },
  streakHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  streakText: { fontSize: 16, fontWeight: "600" },
  checkInBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  checkInBtnText: { fontSize: 13, fontWeight: "600" },
  checkedInBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  checkedInText: { fontSize: 12, fontWeight: "600" },
  streakDots: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  dot: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  goalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  goalInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  goalTitle: { fontSize: 16, fontWeight: "600" },
  goalSub: { fontSize: 12, marginTop: 2 },
  waterControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  waterBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },
  waterBtnText: { fontSize: 18, fontWeight: "500", lineHeight: 20 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  sleepBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  sleepBtnText: { fontSize: 14, fontWeight: "600" },

  stickerBoard: { padding: 16, minHeight: 120 },
  emptySticker: { textAlign: "center", fontSize: 14, marginTop: 30 },
  stickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stickerWrap: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", elevation: 2, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  stickerEmoji: { fontSize: 24 },
}));

registerFeature("habit", HabitApp);
