import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Text } from "../../../../packages/ui/primitives/Typography";
import { Button } from "../../../../packages/ui/primitives/Button";
import { Input } from "../../../../packages/ui/primitives/Input";
import { Switch } from "../../../../packages/ui/primitives/Switch";
import { Skeleton } from "../../../../packages/ui/feedback/Skeleton";
import { ConfirmDialog } from "../../../../packages/ui/feedback/Dialog";
import { EmptyState } from "../../../../packages/ui/feedback/EmptyState";
import { Icon, PageHeader, Surface } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { skins, ThemeProvider, useTheme } from "../../../../packages/ui/theme";
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
      <Text variant="title">组件预览</Text>
      <ComponentPreview />
      <Text variant="caption" style={{ color: colors.ink3 }}>局部风格预览 · 不改变你的外观设置</Text>
      <ThemeProvider skin={skin === "soft" ? "pixel-street" : "soft"}><LocalPreview /></ThemeProvider>
      <Text variant="caption" style={{ color: colors.ink3 }}>外观即时切换，动效遵循手机的减少动态效果设置。</Text>
    </ScrollView>
  </Screen>;
}
function LocalPreview() {
  const { colors, skin } = useTheme();
  return <Surface style={{ padding: 16, gap: 8 }}><View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Icon name="sun" color={colors.accentText} /><Text variant="title">{skin === "soft" ? "Soft" : "Pixel Street"}</Text></View><Text>同一组件，可拥有独立的局部外观。</Text></Surface>;
}
function ComponentPreview() {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(""), [enabled, setEnabled] = useState(true), [open, setOpen] = useState(false), [message, setMessage] = useState("");
  return <Surface style={{ padding: 16, gap: 16 }}>
    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}><Icon name="engine" color={colors.accentText} /><Text variant="title">清晰的层次与可靠的交互</Text></View>
    <Text>字体、图标、轮廓和颜色共同跟随当前风格。</Text>
    <Input label="输入预览" placeholder="试试输入，切换外观后内容仍会保留" value={draft} onChangeText={setDraft} helperText="支持系统字号与原生输入行为" />
    <Switch checked={enabled} onCheckedChange={setEnabled} label="启用预览" />
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      <Button label="打开确认" onPress={() => setOpen(true)} />
      <Button label="次要操作" variant="outline" intent="neutral" onPress={() => setMessage("已点击次要操作")} />
      <Button label="不可用" disabled /><Button label="处理中" busy />
    </View>
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.greenText }}>{message}</Text> : null}
    <View style={{ flexDirection: "row", gap: 4 }}>{[colors.canvas, colors.surface, colors.accent, colors.red, colors.green].map((color, index) => <View key={index} accessibilityLabel={["画布", "内容表面", "主动作", "错误", "成功"][index]} style={{ flex: 1, height: 24, backgroundColor: color, borderRadius: colors.radius.sm }} />)}</View>
    <Skeleton width="72%" height={12} animated={false} />
    <EmptyState style={{ padding: 8 }}><Text variant="caption" style={{ color: colors.ink3 }}>空状态预览</Text></EmptyState>
    <ConfirmDialog open={open} onClose={() => setOpen(false)} title="确认预览操作" description="确认后展示操作完成反馈。" confirmLabel="确认" intent="brand" onConfirm={() => setMessage("预览操作已完成")} />
  </Surface>;
}
