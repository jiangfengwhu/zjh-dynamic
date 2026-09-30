import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type SeparatorProps = {
  orientation?: "horizontal" | "vertical";
  style?: StyleProp<ViewStyle>;
};

export function Separator({ orientation = "horizontal", style }: SeparatorProps) {
  useTheme();
  return (
    <View
      style={[
        orientation === "vertical" ? styles.vertical : styles.horizontal,
        style,
      ]}
    />
  );
}

const styles = themedStyleSheet(() => ({
  horizontal: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.line,
    alignSelf: "stretch",
  },
  vertical: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: theme.line,
    alignSelf: "stretch",
  },
}));
