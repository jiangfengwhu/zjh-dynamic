import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";
import { EdgeModal as Modal } from "../edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function Sheet({ open, onOpenChange, children }: SheetProps) {
  useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={() => onOpenChange(false)}
    >
      <Pressable style={styles.backdrop} onPress={() => onOpenChange(false)}>
        <Pressable
          style={[styles.sheet, { paddingBottom: 28 + insets.bottom }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SheetHeader({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.header, style]} {...rest} />;
}

export function SheetTitle({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.title}>{children}</Text>;
}

export function SheetDescription({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.description}>{children}</Text>;
}

const styles = themedStyleSheet(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: theme.surfaceRaised,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.lineStrong,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.lineStrong,
    alignSelf: "center",
    marginBottom: 4,
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
  },
}));
