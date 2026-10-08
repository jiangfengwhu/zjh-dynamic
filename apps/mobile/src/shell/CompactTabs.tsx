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
      onLayout={(event) => setWidth(event.nativeEvent.layout.width - 6)}
      style={{
        flexDirection: "row",
        alignSelf: "stretch",
        maxWidth: 480,
        height: 36,
        padding: 3,
        backgroundColor: colors.surfaceRaised,
        borderRadius: 18,
      }}
    >
      {slot > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 3,
              top: 3,
              bottom: 3,
              width: slot,
            },
            motion,
          ]}
        >
          <View style={{ flex: 1, borderRadius: 15, backgroundColor: colors.mode === "dark" ? colors.hover2 : colors.surface, boxShadow: "0 1px 2px rgba(40,20,90,0.08), 0 2px 8px rgba(40,20,90,0.08)" }} />
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
            minHeight: 30,
            paddingHorizontal: 6,
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 5,
          }}
        >
          <TabLabel
            label={item.label}
            icon={item.icon}
            index={itemIndex}
            position={progress}
            activeColor={colors.accentText}
            inactiveColor={colors.ink3}
            labelStyle={{ fontSize: 13, lineHeight: 18, fontWeight: "700", letterSpacing: -0.1 }}
          />
        </Pressy>
      ))}
    </View>
  );
}
