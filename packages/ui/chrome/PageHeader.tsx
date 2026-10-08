import { Text } from "../primitives/Typography";
import type { ReactNode } from "react";
import { View } from "react-native";
import { ScreenBar } from "../edge";
import { createThemedStyles, useTheme } from "../theme";
import { Pressy } from "./Pressy";
import { SymbolIcon } from "./SymbolIcon";

/** 圆形图标键：二级页面返回、页面右上角工具共用同一外形。 */
export function RoundButton({ icon, label, onPress, disabled, tint }: { icon: Parameters<typeof SymbolIcon>[0]["name"]; label: string; onPress: () => void; disabled?: boolean; tint?: string }) {
  const { colors } = useTheme();
  return <Pressy accessibilityLabel={label} onPress={onPress} disabled={disabled} scale={0.9} hitSlop={6}
    style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, borderRadius: 18, backgroundColor: colors.surfaceRaised, alignItems: "center", justifyContent: "center" }}>
    <SymbolIcon name={icon} size={18} strokeWidth={2.1} color={tint ?? colors.ink1} />
  </Pressy>;
}
export function BackChip({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  return <RoundButton icon="back" label="返回上一级" onPress={onPress} disabled={disabled} />;
}
/** 有 onBack 时为二级页（居中标题）；backDisabled 只禁用返回键，不改变布局。 */
export function PageHeader({ title, caption, onBack, backDisabled, right }: { title: string; caption?: string; onBack?: () => void; backDisabled?: boolean; right?: ReactNode }) {
  const styles = useStyles();
  // 标题相对内层固定高度的行居中；ScreenBar 的安全区内边距不参与计算。
  if (onBack) return <ScreenBar style={styles.bar}>
    <View style={styles.row}>
      <BackChip onPress={onBack} disabled={backDisabled} />
      <View pointerEvents="none" style={styles.center}>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>{title}</Text>
        {caption ? <Text variant="caption" style={styles.caption} numberOfLines={1}>{caption}</Text> : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  </ScreenBar>;
  return <ScreenBar style={[styles.bar, styles.largeBar]}>
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      {caption ? <Text style={styles.overline} numberOfLines={1}>{caption}</Text> : null}
      <Text accessibilityRole="header" style={styles.display} numberOfLines={1}>{title}</Text>
    </View>
    {right}
  </ScreenBar>;
}
PageHeader.providesBar = true;
const useStyles = createThemedStyles(t => ({
  bar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 2, paddingBottom: 4, backgroundColor: t.canvas },
  row: { flex: 1, height: 44, flexDirection: "row", alignItems: "center" },
  largeBar: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, minHeight: 48, alignItems: "flex-end" },
  center: { position: "absolute", left: 52, right: 52, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
  right: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6 },
  title: { ...t.type.headline, color: t.ink1, textAlign: "center" },
  display: { ...t.type.display, color: t.ink1 },
  overline: { ...t.type.overline, color: t.ink3 },
  caption: { color: t.ink3, textAlign: "center", fontSize: 11, lineHeight: 14 },
}));
