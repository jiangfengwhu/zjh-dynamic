import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";
import { EdgeModal as Modal } from "../edge";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useTheme();
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      <Pressable style={styles.backdrop} onPress={() => onOpenChange(false)}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DialogHeader({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.header, style]} {...rest} />;
}

export function DialogTitle({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.title}>{children}</Text>;
}

export function DialogDescription({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.description}>{children}</Text>;
}

export function DialogFooter({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.footer, style]} {...rest} />;
}

const styles = themedStyleSheet(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.surfaceRaised,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 18,
    gap: 12,
  },
  header: {
    gap: 4,
  },
  title: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "600",
  },
  description: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
  },
}));
