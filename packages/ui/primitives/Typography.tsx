import { createContext, forwardRef, useContext, type ComponentRef } from "react";
import { Text as NativeText, TextInput as NativeTextInput, StyleSheet, type TextProps, type TextInputProps } from "react-native";
import { useTheme } from "../theme";

export type TypographyRole = "body" | "title" | "caption" | "mono";
export type TextInput = NativeTextInput;
const TextParent = createContext<string | undefined>(undefined);
export const Text = forwardRef<ComponentRef<typeof NativeText>, TextProps & { variant?: TypographyRole }>(function Text({ variant, style, children, ...props }, ref) {
  const { colors } = useTheme();
  const parentFamily = useContext(TextParent);
  const sizeRole = !variant || variant === "mono" ? "body" : variant;
  const flat = StyleSheet.flatten(style);
  const fontFamily = flat?.fontFamily ?? (variant === "mono" ? colors.typography.mono : !variant && parentFamily ? parentFamily : colors.typography.body);
  return <NativeText {...props} ref={ref} style={[
    (!parentFamily || variant) && { color: colors.ink1, fontFamily, fontSize: colors.typography.size[sizeRole], lineHeight: colors.typography.lineHeight[sizeRole] },
    style,
    fontFamily === "Fusion Pixel 12px Proportional SC" && { fontWeight: "normal", fontStyle: "normal" },
  ]}><TextParent.Provider value={fontFamily}>{children}</TextParent.Provider></NativeText>;
});

/** Native properties, selection, refs and accessibility remain available. */
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  const { colors } = useTheme();
  const flat = StyleSheet.flatten(style);
  const fontFamily = flat?.fontFamily ?? colors.typography.body;
  return <NativeTextInput placeholderTextColor={colors.ink3} selectionColor={colors.accentText} {...props} ref={ref} style={[
    { color: colors.ink1, fontFamily, fontSize: colors.typography.size.body }, style,
    fontFamily === "Fusion Pixel 12px Proportional SC" && { fontWeight: "normal", fontStyle: "normal" },
  ]} />;
});
