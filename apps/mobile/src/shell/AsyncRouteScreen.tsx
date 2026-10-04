import { useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Screen } from "../../../../packages/ui/edge";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { ThemeContext } from "../../../../packages/ui/theme";
import { PixelText as Text } from "./feed/PixelText";
import { usePixelTheme } from "./feed/pixelTheme";
import { PageSkeleton } from "./LoadingSkeleton";
import { useRouteContentReady } from "./useRouteContentReady";

/** The native route and back action commit before any lookup or bundle loading. */
export function AsyncRouteScreen<T>({ title, load, children, onBack }: {
  title: string;
  load: () => Promise<T>;
  children: (value: T) => ReactNode;
  onBack: () => void;
}) {
  const theme = usePixelTheme();
  const ready = useRouteContentReady();
  const focused = useIsFocused();
  const loader = useRef(load);
  loader.current = load;
  const [result, setResult] = useState<{ value: T }>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready || !focused || result) return;
    let live = true;
    const task = requestIdleCallback(() => {
      void loader.current().then(
        value => { if (live) setResult({ value }); },
        cause => { if (live) setError(cause instanceof Error ? cause.message : "加载失败，请重试"); }
      );
    });
    return () => { live = false; cancelIdleCallback(task); };
  }, [ready, focused, attempt, result]);
  if (result) return <>{children(result.value)}</>;
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
