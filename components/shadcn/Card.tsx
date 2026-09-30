import type { ReactNode } from "react";
import { StyleSheet, Text, View, type TextProps, type ViewProps } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export function Card({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.card, style]} {...rest} />;
}

export function CardHeader({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.header, style]} {...rest} />;
}

export function CardTitle({
  children,
  style,
  ...rest
}: TextProps & { children: ReactNode }) {
  useTheme();
  return (
    <Text style={[styles.title, style]} {...rest}>
      {children}
    </Text>
  );
}

export function CardDescription({
  children,
  style,
  ...rest
}: TextProps & { children: ReactNode }) {
  useTheme();
  return (
    <Text style={[styles.description, style]} {...rest}>
      {children}
    </Text>
  );
}

export function CardContent({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.content, style]} {...rest} />;
}

export function CardFooter({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.footer, style]} {...rest} />;
}

const styles = themedStyleSheet(() => ({
  card: {
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 4,
  },
  title: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "600",
  },
  description: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.line,
  },
}));
