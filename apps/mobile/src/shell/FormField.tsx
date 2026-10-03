import { forwardRef, useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { useTheme } from "../../../../packages/ui/theme";

/** Host fields share contrast, focus and selection treatment without changing form contracts. */
export const FormField = forwardRef<TextInput, TextInputProps>(function FormField({ style, onFocus, onBlur, ...props }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return <TextInput ref={ref} placeholderTextColor={colors.ink3} selectionColor={colors.accentText} {...props}
    onFocus={event => { setFocused(true); onFocus?.(event); }}
    onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[{ minHeight: 44, borderWidth: 1, borderColor: colors.lineStrong, borderRadius: colors.radius.sm, color: colors.ink1, backgroundColor: colors.field, paddingHorizontal: 12, paddingVertical: 10 }, style, focused && { borderColor: colors.accentText }]} />;
});
