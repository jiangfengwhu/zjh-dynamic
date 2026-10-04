import { pixelTheme } from "../pixelTheme";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from "react-native";
import { EdgeModal as Modal } from "../edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { themedStyleSheet, useTheme } from "../theme";

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

const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(25,21,44,0.46)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: t.canvas,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      borderTopWidth: 0.5,
      borderTopColor: t.lineStrong,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 28,
      gap: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.accent,
      alignSelf: "center",
      marginBottom: 4,
    },
    header: {
      gap: 4,
    },
    title: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 16,
      fontWeight: "normal",
    },
    description: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 13,
    },
  };
});
