import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function InputGroup({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  return <View style={[styles.group, style]}>{children}</View>;
}

export function InputGroupAddon({
  align = "inline-start",
  children,
}: {
  align?: "inline-start" | "inline-end";
  children: ReactNode;
}) {
  useTheme();
  return (
    <View
      style={[
        styles.addon,
        align === "inline-start" ? styles.addonStart : styles.addonEnd,
      ]}
    >
      {children}
    </View>
  );
}

export function InputGroupText({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.addonText}>{children}</Text>;
}

export function InputGroupInput(props: TextInputProps) {
  useTheme();
  return (
    <TextInput
      placeholderTextColor={theme.ink3}
      style={styles.input}
      {...props}
    />
  );
}

export function InputGroupButton({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.btn}>
      {typeof children === "string" ? <Text style={styles.btnText}>{children}</Text> : children}
    </Pressable>
  );
}

const styles = themedStyleSheet(() => ({
  group: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    borderRadius: theme.radius.md,
    backgroundColor: theme.field,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    overflow: "hidden",
  },
  addon: {
    paddingHorizontal: 10,
    justifyContent: "center",
    alignSelf: "stretch",
    backgroundColor: theme.inset,
  },
  addonStart: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.line,
  },
  addonEnd: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: theme.line,
  },
  addonText: {
    color: theme.muted,
    fontSize: 12.5,
  },
  input: {
    flex: 1,
    color: theme.text,
    fontSize: 13.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.surfaceRaised,
  },
  btnText: {
    color: theme.text,
    fontSize: 12,
    fontWeight: "600",
  },
}));
