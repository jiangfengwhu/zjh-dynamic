import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { themedStyleSheet, useTheme } from "../theme";

export type AspectRatioProps = {
  ratio?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AspectRatio({ ratio = 16 / 9, children, style }: AspectRatioProps) {
  useTheme();
  return <View style={[styles.box, { aspectRatio: ratio }, style]}>{children}</View>;
}

const styles = themedStyleSheet(() => ({
  box: {
    width: "100%",
    overflow: "hidden",
  },
}));
