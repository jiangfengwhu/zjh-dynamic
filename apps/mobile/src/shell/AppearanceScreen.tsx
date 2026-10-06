import { ScrollView, View } from "react-native";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { getTheme, skins, useTheme } from "../../../../packages/ui/theme";
import { SymbolIcon } from "./feed/PixelKit";
import { CompactTabs } from "./CompactTabs";
const modes = [{ id: "system", label: "跟随系统" }, { id: "light", label: "浅色" }, { id: "dark", label: "深色" }] as const;
export function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const { colors, skin, mode, preference, setSkin, setMode } = useTheme();
  return <Screen style={{ backgroundColor: colors.canvas }}>
    <PageHeader title="外观" onBack={onBack} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: colors.spacing.page, gap: colors.spacing.section }}>
      <Text variant="title">选择你的风格</Text>
      <View accessibilityRole="radiogroup" style={{ gap: 12 }}>{skins.map(item => {
        const selected = item.id === skin;
        const palette = getTheme(item.id, mode);
        return <Pressy key={item.id} accessibilityRole="radio" accessibilityLabel={item.title + "，" + item.description} accessibilityState={{ checked: selected }} onPress={() => setSkin(item.id)} style={{ minHeight: 108, padding: 16, flexDirection: "row", alignItems: "center", gap: 14, borderRadius: colors.radius.lg, backgroundColor: selected ? colors.accentTint : colors.surface }}>
          <View importantForAccessibility="no-hide-descendants" style={{ width: 56, height: 64, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: palette.canvas, borderRadius: palette.radius.md }}>
            <Text style={{ fontFamily: palette.sans, fontSize: 23, lineHeight: 28, color: palette.ink1 }}>花</Text>
            <View style={{ flexDirection: "row", gap: 4 }}>{[palette.accent, palette.orchid, palette.cyan].map((color, index) => <View key={index} style={{ width: 9, height: 9, borderRadius: item.id === "soft" ? 5 : 0, backgroundColor: color }} />)}</View>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
            <Text style={{ fontFamily: palette.sans, fontSize: 17, lineHeight: 24, fontWeight: "700", color: colors.ink1 }}>{item.title}</Text>
            <Text variant="caption" style={{ color: colors.ink2 }}>{item.description}</Text>
          </View>
          <View importantForAccessibility="no-hide-descendants" style={{ width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.accent : colors.inset, borderWidth: selected ? 0 : 1, borderColor: colors.lineStrong }}>
            {selected ? <SymbolIcon name="check" size={16} color={colors.onAccent} /> : null}
          </View>
        </Pressy>;
      })}</View>
      <Text variant="caption">显示模式</Text>
      <CompactTabs value={preference} options={modes} onChange={setMode} />
      <Text variant="caption" style={{ color: colors.ink3 }}>外观即时切换，动效遵循手机的减少动态效果设置。</Text>
    </ScrollView>
  </Screen>;
}
