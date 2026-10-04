import { pixelTheme } from "../pixelTheme";
import type { ReactNode } from "react";
import { Text, View, type ViewProps } from "react-native";
import { themedStyleSheet, useTheme } from "../theme";
import { PixelPopup } from "../chrome/PixelPopup";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  useTheme();
  return (
    <PixelPopup open={open} onClose={() => onOpenChange(false)}>
      {children}
    </PixelPopup>
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

const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
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
      lineHeight: 18,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
      marginTop: 4,
    },
  };
});
