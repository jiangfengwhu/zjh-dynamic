import { Text } from "../primitives/Typography";
import type { ReactNode } from "react";
import { View } from "react-native";
import { createThemedStyles, useTheme } from "../theme";

/** 分组标题：小号、加宽字距的弱化标签，像目录里的栏目名。 */
export function SectionTitle({ children, aside }: { children: string; aside?: ReactNode }) {
  const styles = useStyles();

  useTheme();
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{children}</Text>
      {aside}
    </View>
  );
}

const useStyles = createThemedStyles((t) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingTop: 12,
    paddingBottom: 2,
  },
  text: {
    fontFamily: t.serif,
    ...t.type.overline,
    color: t.ink3,
  },
}));
