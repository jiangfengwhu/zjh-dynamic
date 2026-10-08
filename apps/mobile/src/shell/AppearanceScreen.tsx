import { ScrollView, View } from "react-native";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { getTheme, useTheme, type Theme } from "../../../../packages/ui/theme";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
const modes = [{ id: "system", label: "跟随系统", hint: "随手机的显示设置自动切换", icon: "layers" }, { id: "light", label: "浅色", hint: "明亮底色，糖果配色更跳脱", icon: "sun" }, { id: "dark", label: "深色", hint: "深紫夜色，适合夜间浏览", icon: "moon" }] as const;
export function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const { colors, mode, preference, setMode } = useTheme();
  return <Screen style={{ backgroundColor: colors.canvas }}>
    <PageHeader title="外观" onBack={onBack} />
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 24, gap: 18 }}>
      <View style={{ gap: 4 }}><Text style={{ ...colors.type.title2, color: colors.ink1 }}>舒服地看，尽情地创作。</Text><Text style={{ color: colors.ink2, fontSize: 13, lineHeight: 19 }}>选择适合此刻的显示模式。</Text></View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 10 }}>{modes.map(item => {
        const selected = preference === item.id;
        const palette = getTheme(item.id === "system" ? mode : item.id);
        return <Pressy key={item.id} accessibilityRole="radio" accessibilityLabel={`${item.label}，${item.hint}`} accessibilityState={{ checked: selected }} onPress={() => setMode(item.id)} scale={0.96}
          style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 8, paddingHorizontal: 0, paddingVertical: 0 }}>
          <View importantForAccessibility="no-hide-descendants" style={{ alignSelf: "stretch", padding: 2, borderRadius: 18, borderWidth: 2, borderColor: selected ? colors.accent : "transparent" }}>
            {item.id === "system"
              ? <View style={{ flexDirection: "row", borderRadius: 14, overflow: "hidden" }}><Preview palette={getTheme("light")} half="left" /><Preview palette={getTheme("dark")} half="right" /></View>
              : <Preview palette={palette} />}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: selected ? colors.accent : "transparent", borderWidth: selected ? 0 : 1.5, borderColor: colors.lineStrong }}>
              {selected ? <SymbolIcon name="check" size={10} strokeWidth={3} color={colors.onAccent} /> : null}
            </View>
            <Text style={{ fontSize: 13, fontWeight: "700", letterSpacing: -0.2, color: selected ? colors.accentText : colors.ink1 }}>{item.label}</Text>
          </View>
        </Pressy>;
      })}</View>
      <View style={{ padding: 12, borderRadius: colors.radius.xl, backgroundColor: colors.surface, boxShadow: colors.shadow.card, borderWidth: colors.mode === "dark" ? colors.components.surfaceBorder : 0, borderColor: colors.line, flexDirection: "row", gap: 10, alignItems: "center" }}>
        <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.amberTint }}>
          <SymbolIcon name={modes.find(item => item.id === preference)?.icon ?? "layers"} size={16} strokeWidth={2.1} color={colors.amber} />
        </View>
        <Text style={{ flex: 1, color: colors.ink2, fontSize: 13, lineHeight: 19 }}>{modes.find(item => item.id === preference)?.hint}</Text>
      </View>
    </ScrollView>
  </Screen>;
}
/** 模式缩略图：画布、一张卡片和悬浮导航坞，直接用对应模式的令牌绘制。 */
function Preview({ palette, half }: { palette: Theme; half?: "left" | "right" }) {
  return <View style={[{ flex: half ? 1 : undefined, height: 124, padding: 8, gap: 5, backgroundColor: palette.canvas, justifyContent: "space-between" },
    !half && { borderRadius: 14, borderWidth: palette.components.surfaceBorder, borderColor: palette.line }]}>
    <View style={{ gap: 6 }}>
      <View style={{ width: "60%", height: 8, borderRadius: 4, backgroundColor: palette.ink1 }} />
      <View style={{ height: 44, borderRadius: 10, backgroundColor: palette.surface, borderWidth: palette.mode === "dark" ? palette.components.surfaceBorder : 0, borderColor: palette.line, boxShadow: palette.shadow.card, padding: 7, gap: 5 }}>
        <View style={{ width: "70%", height: 5, borderRadius: 3, backgroundColor: palette.ink2 }} />
        <View style={{ width: "45%", height: 5, borderRadius: 3, backgroundColor: palette.ink3 }} />
      </View>
    </View>
    <View style={{ height: 18, borderRadius: 7, backgroundColor: palette.surface, boxShadow: palette.shadow.float, flexDirection: "row", alignItems: "center", justifyContent: "space-evenly" }}>
      <View style={{ width: 12, height: 7, borderRadius: 4, backgroundColor: palette.accentTint }} />
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: palette.ink3 }} />
      <View style={{ width: 10, height: 8, borderRadius: 3, experimental_backgroundImage: palette.aurora }} />
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: palette.ink3 }} />
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: palette.ink3 }} />
    </View>
  </View>;
}
