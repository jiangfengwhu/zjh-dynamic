import { Switch as NativeSwitch, View, type SwitchProps as NativeSwitchProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme";
import { Text } from "./Typography";
export type SwitchProps = Omit<NativeSwitchProps, "value" | "onValueChange" | "style"> & { checked: boolean; onCheckedChange: (value: boolean) => void; label?: string; style?: StyleProp<ViewStyle> };
export function Switch({ checked, onCheckedChange, label, style, ...props }: SwitchProps) {
  const { colors } = useTheme();
  return <View style={[{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }, style]}>
    {label ? <Text>{label}</Text> : null}
    <NativeSwitch trackColor={{ false: colors.lineStrong, true: colors.green }} thumbColor="#FFFFFF" ios_backgroundColor={colors.lineStrong} accessibilityLabel={label} {...props} value={checked} onValueChange={onCheckedChange} />
  </View>;
}
