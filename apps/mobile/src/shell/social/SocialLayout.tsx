import type { ReactNode } from "react";
import { View } from "react-native";
import { Screen, ScreenEdge } from "../../../../../packages/ui/edge";
import { PageHeader, Pressy } from "../../../../../packages/ui/chrome";
import { ThemeContext } from "../../../../../packages/ui/theme";
import { useTheme } from "../../../../../packages/ui/theme";
import { PixelText as Text } from "../feed/PixelText";
import { EmptyState } from "../EmptyState";
import { PageSkeleton } from "../LoadingSkeleton";
import { requireAccount } from "../account";
export function SocialFrame({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  const theme = useTheme();
  return <ThemeContext.Provider value={theme}><ScreenEdge bottom={false}><Screen style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
    <PageHeader variant="pixel" title={title} onBack={onBack} />
    {children}
  </Screen></ScreenEdge></ThemeContext.Provider>;
}
export function SocialEmpty({ loading, loaded, text, login = false }: { loading: boolean; loaded: boolean; text: string; login?: boolean }) {
  const { colors } = useTheme();
  if (loading && !loaded && !login) return <View style={{ padding: 16 }}><PageSkeleton rows={4} /></View>;
  return <EmptyState><Text style={{ color: colors.ink3, textAlign: "center" }}>{login ? "登录后查看私信" : text}</Text>
    {login ? <Pressy accessibilityRole="button" onPress={() => { void requireAccount(); }} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.accentText }}>登录紫金花</Text></Pressy> : null}
  </EmptyState>;
}
export function SocialError({ error, retry }: { error: string; retry: () => void }) {
  const { colors } = useTheme();
  return error ? <Pressy accessibilityRole="button" accessibilityLabel="重试同步" onPress={retry} style={{ minHeight: 44, padding: 12 }}><Text style={{ color: colors.danger }}>{error} · 点击重试</Text></Pressy> : null;
}
