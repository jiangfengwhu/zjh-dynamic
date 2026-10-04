import { useIsFocused } from "@react-navigation/native";
import { View, type ActivityIndicatorProps } from "react-native";
import { Skeleton } from "../../../../packages/ui/shadcn/Skeleton";
import { usePixelTheme } from "./feed/pixelTheme";

/** Shared compact busy placeholder for buttons and incremental loading. */
export function LoadingSkeleton({
  size,
  color,
  style,
  accessibilityLabel,
  animating = true,
  hidesWhenStopped: _hidesWhenStopped,
  ...props
}: ActivityIndicatorProps) {
  const { colors } = usePixelTheme();
  const focused = useIsFocused();
  if (!animating) return null;
  return (
    <View
      {...props}
      accessibilityState={{ busy: true }}
      accessibilityLabel={accessibilityLabel || "加载中"}
      style={[{ alignItems: "center", justifyContent: "center" }, style]}
    >
      <Skeleton
        animated={focused}
        width={typeof size === "number" ? size : size === "large" ? 40 : 28}
        height={10}
        borderRadius={2}
        style={{ backgroundColor: color || colors.lineStrong }}
      />
    </View>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  const { colors } = usePixelTheme();
  const focused = useIsFocused();
  return (
    <View
      accessibilityLabel="正在加载内容"
      accessibilityState={{ busy: true }}
      style={{ alignSelf: "stretch", gap: 20, paddingVertical: 12 }}
    >
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={{ flexDirection: "row", gap: 12 }}>
          <Skeleton
            animated={focused}
            width={44}
            height={44}
            borderRadius={22}
            style={{ backgroundColor: colors.line }}
          />
          <View style={{ flex: 1, gap: 10, paddingTop: 3 }}>
            <Skeleton
            animated={focused}
              width="60%"
              height={14}
              borderRadius={2}
              style={{ backgroundColor: colors.line }}
            />
            <Skeleton
            animated={focused}
              width="90%"
              height={12}
              borderRadius={2}
              style={{ backgroundColor: colors.line }}
            />
            <Skeleton
            animated={focused}
              width="40%"
              height={10}
              borderRadius={2}
              style={{ backgroundColor: colors.line }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
