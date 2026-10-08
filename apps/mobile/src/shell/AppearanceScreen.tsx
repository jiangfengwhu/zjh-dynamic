import { ScrollView, View } from "react-native";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { getTheme, useTheme } from "../../../../packages/ui/theme";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
const modes = [{ id: "system", label: "跟随系统", hint: "随手机的显示设置自动切换", icon: "layers" }, { id: "light", label: "浅色", hint: "暖白底色，清晰而轻快", icon: "sun" }, { id: "dark", label: "深色", hint: "深墨底色，适合夜间浏览", icon: "moon" }] as const;
export function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const { colors, mode, preference, setMode } = useTheme();
  return <Screen style={{ backgroundColor: colors.canvas }}>
    <PageHeader title="外观" onBack={onBack} />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 24 }}>
      <View style={{ gap: 6 }}><Text style={{ fontSize: 28, lineHeight: 36, fontWeight: "700" }}>舒服地看，尽情地创作。</Text><Text style={{ color: colors.ink2 }}>选择适合此刻的显示模式。</Text></View>
      <View accessibilityRole="radiogroup" style={{ gap: 12 }}>{modes.map(item => {
        const selected = preference === item.id;
        const palette = getTheme(item.id === "system" ? mode : item.id);
        return <Pressy key={item.id} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => setMode(item.id)} style={{ padding: 16, minHeight: 96, borderRadius: 20, backgroundColor: colors.surface, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accentText : colors.line, flexDirection: "row", alignItems: "center", gap: 16 }}>
          <View style={{ width: 52, height: 60, borderRadius: 14, backgroundColor: palette.canvas, borderWidth: 1, borderColor: palette.line, padding: 9, justifyContent: "space-between" }} importantForAccessibility="no-hide-descendants"><SymbolIcon name={item.icon} size={20} color={palette.ink1} /><View style={{ height: 6, width: 30, borderRadius: 3, backgroundColor: palette.accent }} /></View>
          <View style={{ flex: 1, gap: 4 }}><Text style={{ fontWeight: "700", fontSize: 17 }}>{item.label}</Text><Text variant="caption" style={{ color: colors.ink2 }}>{item.hint}</Text></View>
          {selected ? <SymbolIcon name="check" color={colors.accentText} size={22} /> : null}
        </Pressy>;
      })}</View>
    </ScrollView>
  </Screen>;
}
