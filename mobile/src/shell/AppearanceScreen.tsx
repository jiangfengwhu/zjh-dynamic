import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { PageHeader, Surface } from "../../../components/chrome";
import { Screen } from "../../../components/edge";
import { palettes, themedStyleSheet, useTheme, type ThemeMode } from "../../../components/theme";

type Props = {
  mode: ThemeMode;
  onMode: (mode: ThemeMode) => void;
  onBack: () => void;
};

const MODE_OPTIONS: { id: ThemeMode; label: string; hint: string }[] = [
  { id: "dark", label: "夜紫", hint: "墨色底，金色点缀" },
  { id: "light", label: "淡纸", hint: "淡紫纸色，墨色文字" },
];

export function AppearanceScreen({ mode, onMode, onBack }: Props) {
  useTheme();
  return (
    <Screen style={styles.screen}>
      <PageHeader title="外观" caption="选择一套配色" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Segmented value={mode} onChange={onMode} />
      </ScrollView>
    </Screen>
  );
}

/** 两个选项共用一块滑动的金色底，点哪边就滑到哪边。 */
function Segmented({ value, onChange }: { value: ThemeMode; onChange: (mode: ThemeMode) => void }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const slot = width / MODE_OPTIONS.length;
  const x = useSharedValue(0);
  const index = MODE_OPTIONS.findIndex((item) => item.id === value);
  useEffect(() => {
    if (slot) x.value = withSpring(index * slot, { damping: 20, stiffness: 240 });
  }, [index, slot, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <Surface tone="inset" radius={colors.radius.lg} style={styles.segment}>
      <View style={styles.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {slot ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.thumb, { width: slot, backgroundColor: colors.accentTint, borderColor: colors.accentSoft }, thumb]}
          />
        ) : null}
        {MODE_OPTIONS.map((item) => {
          const active = item.id === value;
          const palette = palettes[item.id];
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onChange(item.id)}
              style={styles.cell}
            >
              <View style={[styles.swatch, { backgroundColor: palette.canvas, borderColor: palette.lineStrong }]}>
                <View style={[styles.swatchCore, { backgroundColor: palette.accent }]} />
              </View>
              <View style={styles.copy}>
                <Text style={[styles.label, active && styles.labelActive]}>{item.label}</Text>
                <Text style={styles.hint}>{item.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Surface>
  );
}

const styles = themedStyleSheet((t) => ({
  screen: {
    flex: 1,
    backgroundColor: t.canvas,
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 36,
  },
  segment: {
    padding: 4,
  },
  track: {
    flexDirection: "row",
  },
  thumb: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: t.radius.md,
    borderWidth: 1,
  },
  cell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 64,
    paddingHorizontal: 8,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  copy: {
    gap: 1,
  },
  label: {
    fontSize: 15,
    color: t.ink2,
  },
  labelActive: {
    color: t.accentText,
    fontWeight: "700",
  },
  hint: {
    fontSize: 11.5,
    color: t.ink3,
  },
}));
