import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";

/** Equal-width sections with one spring-driven selection surface. */
export function CompactTabs<T extends string>({ value, options, onChange }: { value: T; options: readonly { id: T; label: string }[]; onChange: (value: T) => void }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const slot = options.length ? width / options.length : 0;
  const index = Math.max(0, options.findIndex(item => item.id === value));
  const x = useSharedValue(0);
  useEffect(() => { x.value = withSpring(index * slot, { damping: 24, stiffness: 320, reduceMotion: ReduceMotion.System }); }, [index, slot, x]);
  const motion = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return <View style={styles.container}><View style={styles.track} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    {slot > 0 ? <Animated.View pointerEvents="none" style={[styles.thumb, { width: slot }, motion]} /> : null}
    {options.map(item => <Pressy key={item.id} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: item.id === value }} onPress={() => onChange(item.id)} style={styles.option}><Text style={[styles.label, item.id === value && { color: colors.ink1, fontWeight: "700" }]}>{item.label}</Text></Pressy>)}
  </View></View>;
}
const styles = themedStyleSheet(t => ({
  container: { padding: 4, borderRadius: t.radius.md, backgroundColor: t.inset },
  track: { flexDirection: "row" },
  thumb: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: t.surfaceRaised, borderRadius: t.radius.sm, borderWidth: 0.5, borderColor: t.lineStrong },
  option: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingVertical: 8, alignItems: "center" },
  label: { color: t.ink3, fontSize: 13, lineHeight: 18, textAlign: "center" },
}));
