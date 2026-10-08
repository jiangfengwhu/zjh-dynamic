import { forwardRef, useState } from "react";
import type { TextInputProps } from "react-native";
import { TextInput } from "../../../../packages/ui/primitives/Typography";
import { useTheme } from "../../../../packages/ui/theme";

/** Native layout is retained for bounded editors and inline chat composers. */
export const FormField = forwardRef<TextInput, TextInputProps>(function FormField({ style, onFocus, onBlur, ...props }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return <TextInput ref={ref} {...props}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[{ minHeight: colors.components.controlHeight, borderWidth: 0, borderColor: "transparent", borderRadius: colors.components.controlRadius, backgroundColor: colors.surfaceRaised, paddingHorizontal: 18, paddingVertical: 12 }, style, focused && { backgroundColor: colors.surface, boxShadow: `0 0 0 1.5px ${colors.ink1}` }]} />;
});
