import { startTransition, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useTheme } from "../../../../packages/ui/theme";

/** Paint the selected tab before mounting its first data-heavy scene. Keep it mounted afterwards. */
export function ShellTabScene({ children }: { children: ReactNode }) {
  const focused = useIsFocused();
  const [ready, setReady] = useState(false);
  const { colors } = useTheme();
  useEffect(() => {
    if (!focused || ready) return;
    let idle: ReturnType<typeof requestIdleCallback> | undefined;
    const frame = requestAnimationFrame(() => {
      idle = requestIdleCallback(() => startTransition(() => setReady(true)));
    });
    return () => {
      cancelAnimationFrame(frame);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [focused, ready]);
  return ready ? (
    children
  ) : (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.canvas,
      }}
    >
      <ActivityIndicator color={colors.accentText} />
    </View>
  );
}
