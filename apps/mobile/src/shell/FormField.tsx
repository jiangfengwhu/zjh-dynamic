import { forwardRef, useState } from "react";
import { StyleSheet, type TextInputProps } from "react-native";
import { TextInput } from "../../../../packages/ui/primitives/Typography";
import { useTheme } from "../../../../packages/ui/theme";

/** Native layout is retained for bounded editors and inline chat composers. */
export const FormField = forwardRef<TextInput, TextInputProps>(function FormField({ style, onFocus, onBlur, ...props }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const flat = StyleSheet.flatten(style);
  // Android replaces EditText's background when boxShadow changes, resetting its
  // native padding. Keep the outline drawable present and only change its color.
  const paddingHorizontal = flat?.paddingHorizontal ?? flat?.padding ?? 16;
  const paddingVertical = flat?.paddingVertical ?? flat?.padding ?? 12;
  const paddingLeft = flat?.paddingLeft ?? flat?.paddingStart ?? paddingHorizontal;
  const paddingRight = flat?.paddingRight ?? flat?.paddingEnd ?? paddingHorizontal;
  return <TextInput ref={ref} {...props}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    underlineColorAndroid="transparent"
    style={[{ minHeight: colors.components.controlHeight, borderWidth: 0, borderColor: "transparent", borderRadius: colors.components.controlRadius, backgroundColor: colors.surfaceRaised, paddingVertical }, style, focused && { backgroundColor: colors.surface }, { paddingLeft, paddingRight, outlineWidth: 1.5, outlineStyle: "solid", outlineColor: focused ? colors.ink1 : "transparent" }]} />;
});
