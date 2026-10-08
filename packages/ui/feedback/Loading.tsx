import { ActivityIndicator, View, type ViewProps } from "react-native";
import { useTheme } from "../theme";
import { Text } from "../primitives/Typography";

export function Loading({ label = "正在加载", style, ...props }: ViewProps & { label?: string }) {
  const { colors } = useTheme();
  return <View {...props} accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={[{ minHeight: 96, justifyContent: "center", alignItems: "center", gap: 12 }, style]}>
    <ActivityIndicator color={colors.ink2} /><Text variant="caption" style={{ color: colors.ink3, letterSpacing: 0.4 }}>{label}</Text>
  </View>;
}
