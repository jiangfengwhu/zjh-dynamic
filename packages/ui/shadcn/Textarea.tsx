import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type TextareaProps = TextInputProps & {
  label?: string;
  helperText?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function Textarea({
  label,
  helperText,
  error,
  containerStyle,
  style,
  ...rest
}: TextareaProps) {
  useTheme();
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        multiline
        textAlignVertical="top"
        placeholderTextColor={theme.ink3}
        style={[styles.textarea, error ? styles.errorBorder : null, style]}
        {...rest}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  wrap: {
    gap: 6,
  },
  label: {
    color: theme.ink1,
    fontSize: 12.5,
    fontWeight: "500",
  },
  textarea: {
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.field,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    color: theme.text,
    fontSize: 13.5,
    lineHeight: 19,
  },
  errorBorder: {
    borderColor: theme.red,
  },
  helperText: {
    color: theme.muted,
    fontSize: 11.5,
  },
  errorText: {
    color: theme.redText,
    fontSize: 11.5,
  },
}));
