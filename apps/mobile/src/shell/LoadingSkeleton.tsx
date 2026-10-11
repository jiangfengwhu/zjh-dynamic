import { NavigationContext } from "@react-navigation/native";
import { useCallback, useContext, useSyncExternalStore } from "react";
import { View } from "react-native";
import { Skeleton } from "../../../../packages/ui/feedback/Skeleton";
import { useTheme } from "../../../../packages/ui/theme";

export type ListSkeletonShape = "feed" | "work" | "application" | "installed" | "notification" | "comment" | "person" | "inbox" | "chat" | "grid" | "picker" | "provider";

/** Placeholder geometry follows the destination list, including its gutters. */
export function PageSkeleton({ rows = 3, shape = "work", inset = 0, animated }: { rows?: number; shape?: ListSkeletonShape; inset?: number; animated?: boolean }) {
  const { colors } = useTheme();
  // Portaled modals have no route context. Their owner can supply visibility.
  const navigation = useContext(NavigationContext);
  const subscribe = useCallback((listener: () => void) => {
    if (!navigation) return () => {};
    const focus = navigation.addListener("focus", listener);
    const blur = navigation.addListener("blur", listener);
    return () => { focus(); blur(); };
  }, [navigation]);
  const snapshot = useCallback(() => navigation?.isFocused() ?? true, [navigation]);
  const focused = useSyncExternalStore(subscribe, snapshot, snapshot);
  const block = (width: number | `${number}%`, height: number, radius = 6) => <Skeleton animated={animated ?? focused} width={width} height={height} borderRadius={radius} style={{ backgroundColor: colors.lineStrong }} />;
  return <View accessibilityLabel="正在加载内容" accessibilityState={{ busy: true }} style={{ alignSelf: "stretch", paddingHorizontal: inset }}>
    {Array.from({ length: rows }, (_, index) => {
      if (shape === "picker") return <View key={index} style={{ gap: 6, paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: colors.components.surfaceBorder, borderBottomColor: colors.line }}>
        {block("55%", 15)}{block("92%", 12)}{block("70%", 12)}
      </View>;
      if (shape === "provider") return <View key={index} style={{ marginBottom: 12, gap: 6 }}>
        <View style={{ borderRadius: colors.radius.xl, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.surface, flexDirection: "row", gap: 10, alignItems: "center" }}>
          <View style={{ flex: 1, gap: 8 }}>{block("55%", 15)}{block("90%", 12)}</View>{block(16, 16, 8)}
        </View>
        <View style={{ alignItems: "flex-end", paddingRight: 12 }}>{block(52, 13)}</View>
      </View>;
      if (shape === "grid") return <View key={index} style={{ flexDirection: "row", paddingVertical: 12 }}>
          {[0, 1, 2, 3].map(column => <View key={column} style={{ flex: 1, alignItems: "center", gap: 6 }}>{block(52, 52, 16)}{block("65%", 12)}</View>)}
      </View>;
      if (shape === "notification") return <View key={index} style={{ paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", gap: 10, borderBottomWidth: colors.components.surfaceBorder, borderBottomColor: colors.line }}>
        {block(36, 36, 18)}
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <View style={{ height: 20, flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1 }}>{block("65%", 14)}</View>{block(38, 11)}</View>
          <View style={{ height: 19, justifyContent: "center" }}>{block("92%", 13)}</View>
          <View style={{ height: 17, justifyContent: "center" }}>{block("55%", 12)}</View>
        </View>
        <View style={{ marginTop: 6 }}>{block(8, 8, 4)}</View>
      </View>;
      if (shape === "chat") {
        const mine = index % 2 === 1;
        return <View key={index} style={{ flexDirection: mine ? "row-reverse" : "row", gap: 8, paddingVertical: 4, alignItems: "flex-start" }}>
          {block(26, 26, 13)}<View style={{ width: index % 3 === 0 ? "68%" : "52%", gap: 5, alignItems: mine ? "flex-end" : "flex-start" }}>
            {block("100%", index % 3 === 0 ? 56 : 36, 18)}{block(50, 11)}
          </View>
        </View>;
      }
      if (shape === "work") return <View key={index} style={{ marginBottom: 10, borderRadius: colors.radius.xl, backgroundColor: colors.surface, boxShadow: colors.shadow.card, borderWidth: colors.mode === "dark" ? colors.components.surfaceBorder : 0, borderColor: colors.line }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 6 }}>
          {block(46, 46, 13)}<View style={{ flex: 1, gap: 6 }}>{block("65%", 15)}{block("90%", 12)}</View>
        </View>
        <View style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 }}>{block(18, 18, 9)}{block(72, 12)}{block(54, 16, 8)}</View>
      </View>;
      const app = shape === "application" || shape === "installed";
      const feed = shape === "feed";
      const comment = shape === "comment";
      const person = shape === "person";
      const avatar = app ? 52 : shape === "inbox" ? 42 : feed || person ? 40 : comment ? 32 : 36;
      return <View key={index} style={{ paddingVertical: app ? 12 : 10, flexDirection: "row", alignItems: app || person ? "center" : "flex-start", gap: app ? 12 : 10, borderBottomWidth: colors.components.surfaceBorder, borderBottomColor: colors.line }}>
        {block(avatar, avatar, app ? 14 : avatar / 2)}
        <View style={{ flex: 1, gap: feed ? 10 : 6, paddingTop: feed ? 3 : 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>{block(feed ? "48%" : "55%", feed ? 15 : 14)}{!app && !person ? block(38, 10) : null}</View>
          {!person ? block("92%", app ? 12 : 13) : null}
          {feed ? <>{block("72%", 13)}{index % 2 === 0 ? block("100%", 140, 12) : null}<View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>{block(32, 12)}{block(32, 12)}{block(32, 12)}{block(32, 10)}</View></> : null}
          {app ? block("38%", 11) : null}
          {comment ? <View style={{ paddingVertical: 8 }}>{block(26, 12)}</View> : null}
        </View>
        {person || app ? block(person ? 64 : 52, person ? 30 : 28, 15) : null}
      </View>;
    })}
  </View>;
}
