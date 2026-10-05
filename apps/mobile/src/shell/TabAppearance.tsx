import { StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { SymbolIcon, type IconSymbol } from "./feed/PixelKit";
import { PixelText } from "./feed/PixelText";

const AnimatedPixelText = Animated.createAnimatedComponent(PixelText);

/** Labels follow the same UI-thread progress as the selection indicator. */
export function TabLabel({
  label,
  icon,
  index,
  position,
  activeColor,
  inactiveColor,
}: {
  label: string;
  icon?: IconSymbol;
  index: number;
  position: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
}) {
  const textStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.max(0, 1 - Math.abs(position.value - index)),
      [0, 1],
      [inactiveColor, activeColor],
    ),
  }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - Math.abs(position.value - index)),
  }));
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
    >
      {icon ? (
        <View>
          <SymbolIcon name={icon} size={14} color={inactiveColor} />
          <Animated.View style={[StyleSheet.absoluteFill, iconStyle]}>
            <SymbolIcon name={icon} size={14} color={activeColor} />
          </Animated.View>
        </View>
      ) : null}
      <AnimatedPixelText
        accessible={false}
        style={[{ fontSize: 13, lineHeight: 20, textAlign: "center" }, textStyle]}
      >
        {label}
      </AnimatedPixelText>
    </View>
  );
}
