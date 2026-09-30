import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type ButtonGroupProps = {
  orientation?: "horizontal" | "vertical";
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ButtonGroup({
  orientation = "horizontal",
  children,
  style,
}: ButtonGroupProps) {
  useTheme();
  return (
    <View
      style={[
        styles.group,
        orientation === "vertical" ? styles.vertical : styles.horizontal,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  group: {
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    backgroundColor: theme.surfaceRaised,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  horizontal: {
    flexDirection: "row",
    alignItems: "center",
  },
  vertical: {
    flexDirection: "column",
  },
}));
