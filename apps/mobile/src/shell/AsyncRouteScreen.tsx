import { useAccount } from "./account";
import { cachedPage, rememberPage, pageCacheKey, dataChanged } from "./pageCache";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Screen } from "../../../../packages/ui/edge";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { ThemeContext } from "../../../../packages/ui/theme";
import { PixelText as Text } from "./feed/PixelText";
import { useTheme } from "../../../../packages/ui/theme";
import { PageSkeleton } from "./LoadingSkeleton";
import { useRouteContentReady } from "./useRouteContentReady";

/** The native route and back action commit before any lookup or bundle loading. */
export function AsyncRouteScreen<T>({ title, load, children, onBack, cacheKey: suppliedKey }: {
  cacheKey?: string;
  title: string;
  load: () => Promise<T>;
  children: (value: T) => ReactNode;
  onBack: () => void;
}) {
  useAccount();
  const theme = useTheme();
  const ready = useRouteContentReady();
  const focused = useIsFocused();
  const loader = useRef(load);
  loader.current = load;
  const cacheKey = suppliedKey ? pageCacheKey(suppliedKey) : undefined;
  const [result, setResult] = useState<{ value: T; key?: string } | undefined>(() => { const value = cacheKey ? cachedPage<T>(cacheKey) : undefined; return value === undefined ? undefined : { value, key: cacheKey }; });
  const visible = result?.key === cacheKey ? result : undefined;
  const displayed = useRef(visible); displayed.current = visible;
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready || !focused || (!cacheKey && displayed.current)) return;
    let live = true;
    const task = requestIdleCallback(() => {
      void loader.current().then(
        value => { if (!live) return; if (cacheKey) rememberPage(cacheKey, value); if (!displayed.current || dataChanged(displayed.current.value, value)) setResult({ value, key: cacheKey }); setError(""); },
        cause => { if (live) setError(cause instanceof Error ? cause.message : "加载失败，请重试"); }
      );
    });
    return () => { live = false; cancelIdleCallback(task); };
  }, [ready, focused, attempt, cacheKey]);
  if (visible) return <View style={{ flex: 1 }}><View style={{ flex: 1 }}>{children(visible.value)}</View>{error ? <Pressy onPress={() => { setError(""); setAttempt(value => value + 1); }}><Text>同步未完成 · 点击重试</Text></Pressy> : null}</View>;
  return <ThemeContext.Provider value={theme}>
    <Screen style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <PageHeader variant="pixel" title={title} onBack={onBack} />
      <View style={{ padding: 16, gap: 16 }}>
        {error ? <>
          <Text style={{ color: theme.colors.redText }}>{error}</Text>
          <Pressy accessibilityRole="button" onPress={() => { setError(""); setAttempt(value => value + 1); }}>
            <Text>重新加载</Text>
          </Pressy>
        </> : <PageSkeleton rows={3} />}
      </View>
    </Screen>
  </ThemeContext.Provider>;
}
