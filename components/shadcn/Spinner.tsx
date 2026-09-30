import { type StyleProp, type ViewStyle } from "react-native";
import { JollyLoading } from "../jolly";

export type SpinnerProps = {
  size?: "small" | "large";
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function Spinner({ size = "small", color, style }: SpinnerProps) {
  return (
    <JollyLoading
      size={size === "large" ? "lg" : "sm"}
      color={color}
      style={style}
    />
  );
}

