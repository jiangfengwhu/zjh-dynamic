import { Text } from "../primitives/Typography";
import type { ReactNode } from "react";
import { View } from "react-native";
import { ScreenBar } from "../edge";
import { createThemedStyles, useTheme } from "../theme";
import { Pressy } from "./Pressy";
import { SymbolIcon } from "./SymbolIcon";
export function BackChip({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressy accessibilityLabel="返回上一级" onPress={onPress} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" }}><SymbolIcon name="back" size={21} color={colors.ink1} /></Pressy>;
}
export function PageHeader({ title, caption, onBack, right }: { title: string; caption?: string; onBack?: () => void; right?: ReactNode }) {
  const styles = useStyles();
  return <ScreenBar style={styles.bar}>
    {onBack ? <BackChip onPress={onBack} /> : null}
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text accessibilityRole="header" style={styles.title} numberOfLines={1}>{title}</Text>{caption ? <Text variant="caption" style={styles.caption} numberOfLines={1}>{caption}</Text> : null}</View>
    {right}
  </ScreenBar>;
}
PageHeader.providesBar = true;
const useStyles = createThemedStyles(t => ({ bar: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, minHeight: 64, backgroundColor: t.canvas }, title: { fontSize: 24, lineHeight: 31, fontWeight: "700", color: t.ink1, letterSpacing: -0.5 }, caption: { color: t.ink3 } }));
