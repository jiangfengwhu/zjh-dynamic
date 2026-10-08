import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import type { IconSymbol } from "../../../../packages/ui/chrome/SymbolIcon";
import { TabLabel } from "./TabAppearance";
import { useTheme } from "../../../../packages/ui/theme";

/** Labels and the selection surface share native pager progress. */
export function CompactTabs<T extends string>({
  value,
  options,
  onChange,
  tone = "sun",
  position,
}: {
  value: T;
  options: readonly { id: T; label: string; icon?: IconSymbol }[];
  onChange: (value: T) => void;
  tone?: "sun" | "mint" | "berry" | "violet";
  position?: SharedValue<number>;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const slot = options.length ? width / options.length : 0;
  const index = Math.max(
    0,
    options.findIndex((item) => item.id === value),
  );
  const localPosition = useSharedValue(index);
  const progress = position ?? localPosition;
  useEffect(() => {
    if (position) return;
    localPosition.value = withTiming(index, {
      duration: 180,
      reduceMotion: ReduceMotion.System,
    });
  }, [index, position, localPosition]);
  const motion = useAnimatedStyle(() => ({
    transform: [{
      translateX: Math.max(0, Math.min(options.length - 1, progress.value)) * slot,
    }],
  }));
  const fill =
    tone === "mint"
      ? colors.green
      : tone === "berry"
        ? colors.red
        : tone === "violet"
          ? colors.orchid
          : colors.accent;
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        alignSelf: "flex-start",
        width: Math.min(options.length * 112, 336),
        maxWidth: "100%",
        height: 44,
        backgroundColor: colors.surfaceRaised,
        borderRadius: colors.radius.pill,
      }}
    >
      {slot > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              top: 4,
              bottom: 4,
              width: slot,
            },
            motion,
          ]}
        >
          <View style={{ flex: 1, marginHorizontal: 4, borderRadius: colors.radius.pill, backgroundColor: fill }} />
        </Animated.View>
      ) : null}
      {options.map((item, itemIndex) => (
        <Pressy
          key={item.id}
          scale={1}
          accessibilityRole="tab"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: item.id === value }}
          onPress={() => onChange(item.id)}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            paddingHorizontal: 8,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 6,
          }}
        >
          <TabLabel
            label={item.label}
            icon={item.icon}
            index={itemIndex}
            position={progress}
            activeColor={colors.onAccent}
            inactiveColor={colors.ink3}
          />
        </Pressy>
      ))}
    </View>
  );
}
