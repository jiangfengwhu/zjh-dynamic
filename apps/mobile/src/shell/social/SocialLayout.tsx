import type { ReactNode } from "react";
import { Screen, ScreenEdge } from "../../../../../packages/ui/edge";
import { PageHeader, Pressy } from "../../../../../packages/ui/chrome";
import { ThemeContext } from "../../../../../packages/ui/theme";
import { useTheme } from "../../../../../packages/ui/theme";
import { HostText as Text } from "../feed/HostText";
import { EmptyState } from "../EmptyState";
import { PageSkeleton, type ListSkeletonShape } from "../LoadingSkeleton";
import { requireAccount } from "../account";
export function SocialFrame({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  const theme = useTheme();
  return <ThemeContext.Provider value={theme}><ScreenEdge bottom={false}><Screen style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
    <PageHeader title={title} onBack={onBack} />
    {children}
  </Screen></ScreenEdge></ThemeContext.Provider>;
}
export function SocialEmpty({ loading, loaded, text, login = false, shape = "inbox", inset = 16 }: { loading: boolean; loaded: boolean; text: string; login?: boolean; shape?: ListSkeletonShape; inset?: number }) {
  const { colors } = useTheme();
  if (loading && !loaded && !login) return <PageSkeleton rows={4} shape={shape} inset={inset} />;
  return <EmptyState><Text style={{ color: colors.ink3, textAlign: "center", fontSize: 15, lineHeight: 22 }}>{login ? "登录后查看私信" : text}</Text>
    {login ? <Pressy accessibilityRole="button" onPress={() => { void requireAccount(); }} style={{ minHeight: 40, paddingHorizontal: 20, borderRadius: 20, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.onAccent, fontWeight: "700" }}>立即登录</Text></Pressy> : null}
  </EmptyState>;
}
export function SocialError({ error, retry }: { error: string; retry: () => void }) {
  const { colors } = useTheme();
  return error ? <Pressy accessibilityRole="button" accessibilityLabel="重试同步" onPress={retry} style={{ minHeight: 44, padding: 12 }}><Text style={{ color: colors.danger }}>{error} · 点击重试</Text></Pressy> : null;
}
