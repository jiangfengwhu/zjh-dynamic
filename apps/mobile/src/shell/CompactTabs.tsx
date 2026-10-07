import { useEffect, useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
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

/** A shared pixel-cut switch: one UI-thread selection surface, no nested pill. */
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
  const { colors, skin } = useTheme();
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
    skin === "soft" ? colors.accent : tone === "mint"
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
        backgroundColor: "transparent",
        borderRadius: 4,
      }}
    >
      {slot > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              top: 5,
              bottom: 5,
              width: slot,
            },
            motion,
          ]}
        >
          {skin === "soft" ? <View style={{ flex: 1, borderRadius: colors.components.controlRadius, backgroundColor: fill }} /> : <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${slot} 34`}
            preserveAspectRatio="none"
          >
            <Path
              d={`M3 0H${slot - 3}V3H${slot}V31H${slot - 3}V34H3V31H0V3H3Z`}
              fill={fill}
            />
          </Svg>}
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
