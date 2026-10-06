import { View, type SwitchProps as NativeSwitchProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../theme";
import { Text } from "./Typography";
import { Switch as ThemeSwitch } from "tamagui";
export type SwitchProps = Omit<NativeSwitchProps, "value" | "onValueChange" | "style"> & { checked: boolean; onCheckedChange: (value: boolean) => void; label?: string; style?: StyleProp<ViewStyle> };
export function Switch({ checked, onCheckedChange, label, style, ...props }: SwitchProps) {
  const { colors } = useTheme();
  return <View style={[{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8 }, style]}>
    {label ? <Text>{label}</Text> : null}
    <ThemeSwitch accessibilityLabel={props.accessibilityLabel ?? label} accessibilityHint={props.accessibilityHint}
      testID={props.testID} disabled={props.disabled} accessibilityState={props.accessibilityState}
      checked={checked} onCheckedChange={onCheckedChange} backgroundColor={checked ? colors.accent : colors.lineStrong}>
      <ThemeSwitch.Thumb backgroundColor={checked ? colors.onAccent : colors.ink3} />
    </ThemeSwitch>
  </View>;
}
