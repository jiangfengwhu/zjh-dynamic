import { ScrollView, View } from "react-native";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { Button } from "../../../../packages/ui/primitives/Button";
import { PageHeader, Surface } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { skins, useTheme } from "../../../../packages/ui/theme";
import { CompactTabs } from "./CompactTabs";
const modes = [{ id: "system", label: "跟随系统" }, { id: "light", label: "浅色" }, { id: "dark", label: "深色" }] as const;
export function AppearanceScreen({ onBack }: { onBack: () => void }) {
  const { colors, skin, preference, setSkin, setMode } = useTheme();
  return <Screen style={{ backgroundColor: colors.canvas }}>
    <PageHeader title="外观" onBack={onBack} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: colors.spacing.page, gap: colors.spacing.section }}>
      <Text variant="title">选择你的风格</Text>
      <View style={{ gap: 8 }}>{skins.map(item => <Surface key={item.id}>
        <Button label={item.title + (item.id === skin ? " · 已选择" : "")} intent={item.id === skin ? "brand" : "neutral"} variant="ghost" onPress={() => setSkin(item.id)} accessibilityState={{ selected: item.id === skin }} />
        <Text variant="caption" style={{ paddingHorizontal: 16, paddingBottom: 12, color: colors.ink3 }}>{item.description}</Text>
      </Surface>)}</View>
      <Text variant="caption">显示模式</Text>
      <CompactTabs value={preference} options={modes} onChange={setMode} />
      <Text variant="caption" style={{ color: colors.ink3 }}>外观即时切换，动效遵循手机的减少动态效果设置。</Text>
    </ScrollView>
  </Screen>;
}
