import { useEffect, useState } from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Pressy } from "../../../../packages/ui/chrome";
import { PixelText } from "./feed/PixelText";
import { PixelIcon, type PixelSymbol } from "./feed/PixelKit";
import { usePixelTheme } from "./feed/pixelTheme";

/** A shared pixel-cut switch: one UI-thread selection surface, no nested pill. */
export function CompactTabs<T extends string>({
  value,
  options,
  onChange,
  tone = "sun",
}: {
  value: T;
  options: readonly { id: T; label: string; icon?: PixelSymbol }[];
  onChange: (value: T) => void;
  tone?: "sun" | "mint" | "berry" | "violet";
}) {
  const { colors } = usePixelTheme();
  const [width, setWidth] = useState(0);
  const slot = options.length ? width / options.length : 0;
  const index = Math.max(
    0,
    options.findIndex((item) => item.id === value),
  );
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withTiming(index * slot, {
      duration: 180,
      reduceMotion: ReduceMotion.Never,
    });
  }, [index, slot, x]);
  const motion = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
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
          <Svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${slot} 34`}
            preserveAspectRatio="none"
          >
            <Path
              d={`M3 0H${slot - 3}V3H${slot}V31H${slot - 3}V34H3V31H0V3H3Z`}
              fill={fill}
            />
          </Svg>
        </Animated.View>
      ) : null}
      {options.map((item) => (
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
          {item.icon ? (
            <PixelIcon
              name={item.icon}
              size={14}
              color={item.id === value ? colors.onAccent : colors.ink3}
            />
          ) : null}
          <PixelText
            style={{
              color: item.id === value ? colors.onAccent : colors.ink3,
              fontSize: 13,
              lineHeight: 20,
              fontWeight: item.id === value ? "700" : "500",
              textAlign: "center",
            }}
          >
            {item.label}
          </PixelText>
        </Pressy>
      ))}
    </View>
  );
}
