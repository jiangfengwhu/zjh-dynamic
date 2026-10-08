import { afterInteractions, waitForInteractions } from "./interactionWork";
import { useAccount } from "./account";
import { cachedPage, rememberPage, pageCacheKey, dataChanged } from "./pageCache";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Screen } from "../../../../packages/ui/edge";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { ThemeContext } from "../../../../packages/ui/theme";
import { HostText as Text } from "./feed/HostText";
import { useTheme } from "../../../../packages/ui/theme";
import { PageSkeleton } from "./LoadingSkeleton";

/** The native route and back action commit before any lookup or bundle loading. */
export function AsyncRouteScreen<T>({ title, load, children, onBack, cacheKey: suppliedKey, renderErrorAction }: {
  renderErrorAction?: (error: Error) => ReactNode;
  cacheKey?: string;
  title: string;
  load: () => Promise<T>;
  children: (value: T) => ReactNode;
  onBack: () => void;
}) {
  useAccount();
  const theme = useTheme();
  const focused = useIsFocused();
  const loader = useRef(load);
  loader.current = load;
  const cacheKey = suppliedKey ? pageCacheKey(suppliedKey) : undefined;
  const [result, setResult] = useState<{ value: T; key?: string } | undefined>(() => { const value = cacheKey ? cachedPage<T>(cacheKey) : undefined; return value === undefined ? undefined : { value, key: cacheKey }; });
  const visible = result?.key === cacheKey ? result : undefined;
  const displayed = useRef(visible); displayed.current = visible;
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!focused || (!cacheKey && displayed.current)) return;
    let live = true;
    const run = () => {
      void loader.current().then(
        async value => { await waitForInteractions(); if (!live) return; if (cacheKey) rememberPage(cacheKey, value); if (!displayed.current || dataChanged(displayed.current.value, value)) setResult({ value, key: cacheKey }); setError(null); },
        cause => { if (live) setError(cause instanceof Error ? cause : new Error("加载失败，请重试")); }
      );
    };
    // Missing data is necessary work: start after the route commits. Only
    // background revalidation of displayed content waits for an idle slot.
    const cached = !!displayed.current;
    const cancel = cached ? afterInteractions(run) : (() => { const frame = requestAnimationFrame(run); return () => cancelAnimationFrame(frame); })();
    return () => { live = false; cancel(); };
  }, [focused, attempt, cacheKey]);
  if (visible) return <View style={{ flex: 1 }}><View style={{ flex: 1 }}>{children(visible.value)}</View>{error ? <Pressy onPress={() => { setError(null); setAttempt(value => value + 1); }}><Text>同步未完成 · 点击重试</Text></Pressy> : null}</View>;
  return <ThemeContext.Provider value={theme}>
    <Screen style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <PageHeader title={title} onBack={onBack} />
      <View style={{ padding: 16, gap: 16 }}>
        {error ? <>
          <Text accessibilityRole="alert" style={{ color: theme.colors.redText }}>{error.message}</Text>
          {renderErrorAction?.(error)}
          <Pressy accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => { setError(null); setAttempt(value => value + 1); }}>
            <Text>重新加载</Text>
          </Pressy>
        </> : <PageSkeleton rows={3} />}
      </View>
    </Screen>
  </ThemeContext.Provider>;
}
