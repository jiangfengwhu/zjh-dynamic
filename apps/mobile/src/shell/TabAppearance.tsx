import { StyleSheet, View, type StyleProp, type TextStyle } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { SymbolIcon, type IconSymbol } from "../../../../packages/ui/chrome/SymbolIcon";
import { HostText } from "./feed/HostText";

const AnimatedHostText = Animated.createAnimatedComponent(HostText);

/** Labels follow the same UI-thread progress as the selection indicator. */
export function TabLabel({
  label,
  icon,
  index,
  position,
  activeColor,
  inactiveColor,
  labelStyle,
}: {
  label: string;
  icon?: IconSymbol;
  index: number;
  position: SharedValue<number>;
  activeColor: string;
  inactiveColor: string;
  labelStyle?: StyleProp<TextStyle>;
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
      <AnimatedHostText
        accessible={false}
        style={[{ fontSize: 14, lineHeight: 21, fontWeight: "600", textAlign: "center" }, labelStyle, textStyle]}
      >
        {label}
      </AnimatedHostText>
    </View>
  );
}
