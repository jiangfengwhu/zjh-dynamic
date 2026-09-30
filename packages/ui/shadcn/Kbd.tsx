import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function Kbd({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return (
    <View style={[styles.kbd, style]}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

export function KbdGroup({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  useTheme();
  return <View style={[styles.group, style]}>{children}</View>;
}

const styles = themedStyleSheet(() => ({
  kbd: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    alignSelf: "flex-start",
  },
  text: {
    color: theme.ink2,
    fontSize: 11,
    fontWeight: "600",
  },
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
}));
