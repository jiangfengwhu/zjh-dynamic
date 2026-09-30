import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { EdgeModal as Modal } from "../edge";
import { Button } from "./Button";
import { theme, themedStyleSheet, useTheme } from "../theme";

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
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}>
        <View style={[styles.card, style]}>{children}</View>
      </View>
    </Modal>
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
  return (
    <Button
      variant={variant}
      size="sm"
      onPress={() => {
        onPress?.();
        setOpen(false);
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
  return (
    <Button
      variant="outline"
      size="sm"
      onPress={() => {
        onPress?.();
        setOpen(false);
      }}
    >
      {children}
    </Button>
  );
}

const styles = themedStyleSheet(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: theme.surfaceRaised,
    borderRadius: theme.radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 18,
    gap: 12,
  },
  header: {
    gap: 6,
  },
  title: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "600",
  },
  desc: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 4,
  },
}));
