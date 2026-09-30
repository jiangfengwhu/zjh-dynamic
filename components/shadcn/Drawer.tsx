import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type ViewProps } from "react-native";
import { EdgeModal as Modal } from "../edge";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, themedStyleSheet, useTheme } from "../theme";

const DrawerContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function Drawer({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (v: boolean) => void;
  children: ReactNode;
}) {
  const [internal, setInternal] = useState(defaultOpen);
  const open = controlledOpen ?? internal;
  const setOpen = (next: boolean) => {
    setInternal(next);
    onOpenChange?.(next);
  };
  return (
    <DrawerContext.Provider value={{ open, setOpen }}>
      {children}
    </DrawerContext.Provider>
  );
}

export function DrawerTrigger({ children }: { children: ReactNode }) {
  useTheme();
  const { setOpen } = useContext(DrawerContext);
  return <Pressable onPress={() => setOpen(true)}>{children}</Pressable>;
}

export function DrawerClose({ children }: { children: ReactNode }) {
  useTheme();
  const { setOpen } = useContext(DrawerContext);
  return <Pressable onPress={() => setOpen(false)}>{children}</Pressable>;
}

export function DrawerContent({ children }: { children: ReactNode }) {
  useTheme();
  const { open, setOpen } = useContext(DrawerContext);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        <Pressable style={[styles.drawer, { paddingBottom: 26 + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DrawerHeader({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.header, style]} {...rest} />;
}

export function DrawerFooter({ style, ...rest }: ViewProps) {
  useTheme();
  return <View style={[styles.footer, style]} {...rest} />;
}

export function DrawerTitle({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.title}>{children}</Text>;
}

export function DrawerDescription({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.desc}>{children}</Text>;
}

const styles = themedStyleSheet(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  drawer: {
    backgroundColor: theme.surfaceRaised,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.lineStrong,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 26,
    gap: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.lineStrong,
    alignSelf: "center",
    marginBottom: 4,
  },
  header: {
    gap: 4,
  },
  footer: {
    gap: 8,
    marginTop: 4,
  },
  title: {
    color: theme.text,
    fontSize: 16,
    fontWeight: "600",
  },
  desc: {
    color: theme.muted,
    fontSize: 13,
  },
}));
