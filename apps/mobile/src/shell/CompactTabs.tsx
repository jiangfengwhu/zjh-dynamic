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
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 8)}
      style={{
        flexDirection: "row",
        alignSelf: "stretch",
        maxWidth: 480,
        height: 44,
        padding: 4,
        backgroundColor: colors.surfaceRaised,
        borderRadius: 22,
      }}
    >
      {slot > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 4,
              top: 4,
              bottom: 4,
              width: slot,
            },
            motion,
          ]}
        >
          <View style={{ flex: 1, borderRadius: 18, backgroundColor: colors.mode === "dark" ? colors.hover2 : colors.surface, boxShadow: "0 1px 2px rgba(24,20,14,0.06), 0 4px 12px rgba(24,20,14,0.08)" }} />
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
            minHeight: 36,
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
            activeColor={colors.ink1}
            inactiveColor={colors.ink3}
            labelStyle={{ fontSize: 14, lineHeight: 20, fontWeight: "700", letterSpacing: -0.1 }}
          />
        </Pressy>
      ))}
    </View>
  );
}
