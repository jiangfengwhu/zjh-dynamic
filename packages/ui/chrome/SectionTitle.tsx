import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { themedStyleSheet, useTheme } from "../theme";

/** 分组标题。句首大写、常规字重，不做大写字母和装饰。 */
export function SectionTitle({ children, aside }: { children: string; aside?: ReactNode }) {
  useTheme();
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{children}</Text>
      {aside}
    </View>
  );
}

const styles = themedStyleSheet((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0,
    paddingTop: 8,
    paddingBottom: 0,
  },
  text: {
    fontFamily: t.serif,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: t.ink3,
    letterSpacing: 0,
  },
}));
