import {
  ActivityIndicator,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export type SpinnerProps = {
  size?: "small" | "large";
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Spinner({ size = "small", color, style }: SpinnerProps) {
  return <ActivityIndicator size={size} color={color} style={style} />;
}
