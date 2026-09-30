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
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 2,
  },
  text: {
    fontFamily: t.serif,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: t.ink2,
    letterSpacing: 0.3,
  },
}));
