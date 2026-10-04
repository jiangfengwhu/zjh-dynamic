import { pixelTheme } from "../pixelTheme";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { Button } from "./Button";
import { themedStyleSheet, useTheme } from "../theme";
import { PixelPopup } from "../chrome/PixelPopup";
import { usePixelTheme } from "../pixelTheme";

type AlertDialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

const AlertDialogContext = createContext<AlertDialogContextValue>({
  open: false,
  setOpen: () => {},
});

export type AlertDialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
};

export function AlertDialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: AlertDialogProps) {
  useTheme();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <AlertDialogContext.Provider value={{ open: isOpen, setOpen }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

export function AlertDialogTrigger({ children }: { children: ReactNode }) {
  useTheme();
  const { setOpen } = useContext(AlertDialogContext);
  return <Pressable onPress={() => setOpen(true)}>{children}</Pressable>;
}

export function AlertDialogContent({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  const { open, setOpen } = useContext(AlertDialogContext);
  return (
    <PixelPopup
      open={open}
      onClose={() => setOpen(false)}
      dismissible={false}
      style={style}
    >
      {children}
    </PixelPopup>
  );
}

export function AlertDialogHeader({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.header, style]} {...rest} />;
}

export function AlertDialogFooter({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.footer, style]} {...rest} />;
}

export function AlertDialogTitle({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.title}>{children}</Text>;
}

export function AlertDialogDescription({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.desc}>{children}</Text>;
}

export function AlertDialogAction({
  children = "Continue",
  variant = "default",
  onPress,
}: {
  children?: ReactNode;
  variant?: "default" | "destructive";
  onPress?: () => void;
}) {
  const { setOpen } = useContext(AlertDialogContext);
  const { colors } = usePixelTheme();
  return (
    <Button
      variant={variant}
      size="sm"
      style={{
        minHeight: 44,
        borderRadius: 8,
        backgroundColor:
          variant === "destructive" ? colors.redTint : colors.accent,
      }}
      textStyle={{
        color: variant === "destructive" ? colors.redText : colors.onAccent,
        fontFamily: colors.mono,
      }}
      onPress={() => {
        setOpen(false);
        requestAnimationFrame(() => onPress?.());
      }}
    >
      {children}
    </Button>
  );
}

export function AlertDialogCancel({
  children = "Cancel",
  onPress,
}: {
  children?: ReactNode;
  onPress?: () => void;
}) {
  const { setOpen } = useContext(AlertDialogContext);
  const { colors } = usePixelTheme();
  return (
    <Button
      variant="outline"
      size="sm"
      style={{
        minHeight: 44,
        borderRadius: 8,
        borderWidth: 0,
        backgroundColor: colors.inset,
      }}
      textStyle={{ color: colors.ink2, fontFamily: colors.mono }}
      onPress={() => {
        setOpen(false);
        requestAnimationFrame(() => onPress?.());
      }}
    >
      {children}
    </Button>
  );
}

const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    header: {
      gap: 6,
    },
    title: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 16,
      fontWeight: "normal",
    },
    desc: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 13,
      lineHeight: 19,
    },
    footer: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: 8,
      marginTop: 4,
    },
  };
});
