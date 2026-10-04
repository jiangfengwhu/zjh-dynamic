import { View, type StyleProp, type ViewStyle } from "react-native";
import { Skeleton } from "./Skeleton";

export type SpinnerProps = {
  size?: "small" | "large";
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Spinner({ size = "small", color, style }: SpinnerProps) {
  return (
    <View
      accessibilityLabel="加载中"
      accessibilityState={{ busy: true }}
      style={style}
    >
      <Skeleton
        width={size === "large" ? 40 : 28}
        height={10}
        borderRadius={2}
        style={color ? { backgroundColor: color } : undefined}
      />
    </View>
  );
}
