import { forwardRef, useId, useState } from "react";
import { View, type StyleProp, type TextInputProps, type ViewStyle } from "react-native";
import type { ReactNode } from "react";
import { TextInput } from "./Typography";
import { Field } from "./Field";
import { useTheme } from "../theme";
export type InputProps = TextInputProps & { label?: string; helperText?: string; error?: string; disabled?: boolean; leftSlot?: ReactNode; rightSlot?: ReactNode; containerStyle?: StyleProp<ViewStyle> };
export const Input = forwardRef<TextInput, InputProps>(function Input({ label, helperText, error, disabled = false, leftSlot, rightSlot, containerStyle, style, onFocus, onBlur, accessibilityLabel, accessibilityHint, ...props }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const labelId = useId();
  return <Field label={label} labelId={labelId} hint={helperText} error={error} style={containerStyle}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: colors.components.controlHeight, paddingHorizontal: colors.spacing.control, borderRadius: colors.components.controlRadius, backgroundColor: colors.field, borderWidth: 1, borderColor: error ? colors.red : focused ? colors.accentText : colors.line, opacity: disabled || props.editable === false ? 0.55 : 1 }}>
      {leftSlot}<TextInput {...props} editable={!disabled && props.editable !== false} ref={ref} accessibilityLabel={accessibilityLabel ?? label} accessibilityLabelledBy={label ? labelId : props.accessibilityLabelledBy}
        accessibilityState={{ ...props.accessibilityState, disabled: disabled || props.editable === false }}
        accessibilityHint={accessibilityHint ?? error ?? helperText}
        onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }}
        style={[{ flex: 1, paddingVertical: 10 }, style]} />{rightSlot}
    </View>
  </Field>;
});
