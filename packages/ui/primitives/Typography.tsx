import { createContext, forwardRef, useContext, type ComponentRef, type ComponentType } from "react";
import { Text as NativeText, TextInput as NativeTextInput, StyleSheet, type TextProps, type TextInputProps } from "react-native";
import { useTheme } from "../theme";
import { Text as ThemeText, Input as ThemeInput, TextArea } from "tamagui";

export type TypographyRole = "body" | "title" | "caption" | "mono";
export type TextInput = NativeTextInput;
export const TextFontContext = createContext<string | undefined>(undefined);
export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps & { variant?: TypographyRole }>(function Text({ variant, style, children, ...props }, ref) {
  const { colors } = useTheme();
  const parentFamily = useContext(TextFontContext);
  const sizeRole = !variant || variant === "mono" ? "body" : variant;
  const flat = StyleSheet.flatten(style);
  const fontFamily = flat?.fontFamily ?? (variant === "mono" ? colors.typography.mono : !variant && parentFamily ? parentFamily : colors.typography.body);
  return <ThemeText unstyled {...props} ref={ref as never} style={[
    (!parentFamily || variant) && { color: colors.ink1, fontFamily, fontSize: colors.typography.size[sizeRole], lineHeight: colors.typography.lineHeight[sizeRole] },
    style,
    fontFamily === "Fusion Pixel 12px Proportional SC" && { fontWeight: "normal", fontStyle: "normal" },
  ]}><TextFontContext.Provider value={fontFamily}>{children}</TextFontContext.Provider></ThemeText>;
});

/** Native properties, selection, refs and accessibility remain available. */
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, placeholderTextColor, selectionColor, ...props }, ref) {
  const { colors } = useTheme();
  const flat = StyleSheet.flatten(style);
  const fontFamily = flat?.fontFamily ?? colors.typography.body;
  // Tamagui's declarations also include web event props. This host adapter only
  // forwards the native TextInput contract to its native implementation.
  const Control = (props.multiline ? TextArea : ThemeInput) as ComponentType<TextInputProps & { unstyled?: boolean; ref?: typeof ref }>;
  return <Control unstyled placeholderTextColor={placeholderTextColor ?? colors.ink3} selectionColor={selectionColor ?? colors.accentText} {...props} ref={ref} style={[
    { color: colors.ink1, fontFamily, fontSize: colors.typography.size.body }, style,
    fontFamily === "Fusion Pixel 12px Proportional SC" && { fontWeight: "normal", fontStyle: "normal" },
  ]} />;
});
