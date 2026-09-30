import { useState, type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { themedStyleSheet, useTheme } from "../theme";

export type InputProps = TextInputProps & {
  label?: string;
  helperText?: string;
  error?: string;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Input({
  label,
  helperText,
  error,
  leftSlot,
  rightSlot,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.field, focused && { borderColor: colors.accentSoft, backgroundColor: colors.field }, error ? styles.fieldError : null]}>
        {leftSlot}
        <TextInput
          placeholderTextColor={colors.ink3}
          style={[styles.input, style]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...rest}
        />
        {rightSlot}
      </View>
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = themedStyleSheet((t) => ({
  wrap: {
    gap: 6,
  },
  label: {
    color: t.ink2,
    fontSize: 13,
    fontWeight: "600",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: t.radius.md,
    backgroundColor: t.field,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.lineStrong,
  },
  fieldError: {
    borderColor: t.red,
  },
  input: {
    flex: 1,
    color: t.text,
    fontSize: 15,
    paddingVertical: 8,
  },
  helperText: {
    color: t.muted,
    fontSize: 12,
  },
  errorText: {
    color: t.redText,
    fontSize: 12,
  },
}));
