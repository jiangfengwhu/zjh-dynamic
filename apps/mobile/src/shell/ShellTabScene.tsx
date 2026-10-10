import { useRoute, useIsFocused } from "@react-navigation/native";
import { PageSkeleton } from "./LoadingSkeleton";
import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { useTheme } from "../../../../packages/ui/theme";
import { Ambient } from "../../../../packages/ui/chrome";
import { markStartup } from "../runtime/startupTiming";

/** Mount only after a visit, then retain the scene and its scroll state. */
export function ShellTabScene({ children, immediate = false }: { children: ReactNode | (() => ReactNode); immediate?: boolean }) {
  const focused = useIsFocused();
  const route = useRoute();
  const [ready, setReady] = useState(immediate && focused);
  const { colors } = useTheme();
  const [showSkeleton, setShowSkeleton] = useState(false);
  useEffect(() => { if (ready || !focused) return; const timer = setTimeout(() => setShowSkeleton(true), 200); return () => clearTimeout(timer); }, [ready, focused]);
  useEffect(() => {
    if (ready || !focused) return;
    // Paint the selected route before mounting its content. Hidden routes never
    // schedule work, and a quick switch cancels this first visit.
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [focused, ready]);
  useEffect(() => {
    if (ready) markStartup(`tab-${route.name}-ready`);
  }, [ready, route.name]);
  return ready || (immediate && focused) ? (typeof children === "function" ? children() : children) : (
    <View style={{ flex: 1, padding: 16, backgroundColor: colors.canvas }}>
      <Ambient />
      {focused && showSkeleton ? <PageSkeleton rows={4} shape={route.name === "market" ? "feed" : route.name === "feed" ? "application" : route.name === "notifications" ? "notification" : "work"} /> : null}
    </View>
  );
}
