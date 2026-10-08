import { Text } from "../primitives/Typography";
import type { ReactNode } from "react";
import { View } from "react-native";
import { ScreenBar } from "../edge";
import { createThemedStyles, useTheme } from "../theme";
import { Pressy } from "./Pressy";
import { SymbolIcon } from "./SymbolIcon";
export function BackChip({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressy accessibilityLabel="返回上一级" onPress={onPress} scale={0.92} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface, borderWidth: colors.components.surfaceBorder, borderColor: colors.line, alignItems: "center", justifyContent: "center" }}><SymbolIcon name="back" size={20} strokeWidth={2.2} color={colors.ink1} /></Pressy>;
}
export function PageHeader({ title, caption, onBack, right }: { title: string; caption?: string; onBack?: () => void; right?: ReactNode }) {
  const styles = useStyles();
  return <ScreenBar style={styles.bar}>
    {onBack ? <BackChip onPress={onBack} /> : null}
    <View style={{ flex: 1, minWidth: 0, gap: 1 }}><Text accessibilityRole="header" style={onBack ? styles.title : styles.display} numberOfLines={1}>{title}</Text>{caption ? <Text variant="caption" style={styles.caption} numberOfLines={1}>{caption}</Text> : null}</View>
    {right}
  </ScreenBar>;
}
PageHeader.providesBar = true;
const useStyles = createThemedStyles(t => ({
  bar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, minHeight: 62, backgroundColor: t.canvas },
  title: { fontSize: 18, lineHeight: 25, fontWeight: "700", color: t.ink1, letterSpacing: -0.2 },
  display: { fontSize: 30, lineHeight: 38, fontWeight: "800", color: t.ink1, letterSpacing: -0.6, paddingLeft: 4 },
  caption: { color: t.ink3 },
}));
