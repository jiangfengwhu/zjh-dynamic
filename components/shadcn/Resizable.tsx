import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function ResizablePanelGroup({
  direction = "horizontal",
  children,
  style,
}: {
  direction?: "horizontal" | "vertical";
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  return (
    <View
      style={[
        styles.group,
        direction === "vertical" ? styles.vertical : styles.horizontal,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ResizablePanel({
  defaultSize = 50,
  children,
  style,
}: {
  defaultSize?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  return <View style={[styles.panel, { flex: defaultSize }, style]}>{children}</View>;
}

export function ResizableHandle({ withHandle }: { withHandle?: boolean }) {
  useTheme();
  return (
    <View style={styles.handleBar}>
      {withHandle ? <View style={styles.grip} /> : null}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  group: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    backgroundColor: theme.surfaceRaised,
    overflow: "hidden",
  },
  horizontal: {
    flexDirection: "row",
  },
  vertical: {
    flexDirection: "column",
  },
  panel: {
    padding: 12,
  },
  handleBar: {
    width: 6,
    backgroundColor: theme.inset,
    alignItems: "center",
    justifyContent: "center",
  },
  grip: {
    width: 2,
    height: 18,
    borderRadius: 1,
    backgroundColor: theme.lineStrong,
  },
}));
