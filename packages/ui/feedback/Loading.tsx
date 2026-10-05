import { ActivityIndicator, View, type ViewProps } from "react-native";
import { useTheme } from "../theme";
import { Text } from "../primitives/Typography";

export function Loading({ label = "正在加载", style, ...props }: ViewProps & { label?: string }) {
  const { colors } = useTheme();
  return <View {...props} accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={[{ minHeight: 80, justifyContent: "center", alignItems: "center", gap: 8 }, style]}>
    <ActivityIndicator color={colors.accentText} /><Text variant="caption" style={{ color: colors.ink3 }}>{label}</Text>
  </View>;
}
