import type { ReactNode } from "react";
import { StyleSheet, Text, type TextProps } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type LabelProps = TextProps & {
  children: ReactNode;
  required?: boolean;
  disabled?: boolean;
};

export function Label({ children, required, disabled, style, ...rest }: LabelProps) {
  useTheme();
  return (
    <Text style={[styles.label, disabled && styles.disabled, style]} {...rest}>
      {children}
      {required ? <Text style={styles.req}> *</Text> : null}
    </Text>
  );
}

const styles = themedStyleSheet(() => ({
  label: {
    color: theme.ink1,
    fontSize: 12.5,
    fontWeight: "500",
  },
  req: {
    color: theme.redText,
  },
  disabled: {
    opacity: 0.4,
  },
}));
