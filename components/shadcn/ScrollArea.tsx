import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type ScrollAreaProps = ScrollViewProps & {
  orientation?: "vertical" | "horizontal";
  maxHeight?: number;
  containerStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
};

export function ScrollArea({
  orientation = "vertical",
  maxHeight = 220,
  containerStyle,
  children,
  ...rest
}: ScrollAreaProps) {
  useTheme();
  return (
    <View style={[styles.wrap, { maxHeight }, containerStyle]}>
      <ScrollView
        horizontal={orientation === "horizontal"}
        showsVerticalScrollIndicator
        showsHorizontalScrollIndicator={orientation === "horizontal"}
        {...rest}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function ScrollBar() {
  useTheme();
  return null;
}

const styles = themedStyleSheet(() => ({
  wrap: {
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    overflow: "hidden",
  },
}));
