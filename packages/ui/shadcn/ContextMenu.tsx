import { pixelTheme } from "../pixelTheme";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EdgeModal as Modal } from "../edge";
import { themedStyleSheet, useTheme } from "../theme";

const ContextMenuContext = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

export function ContextMenu({ children }: { children: ReactNode }) {
  useTheme();
  const [open, setOpen] = useState(false);
  return (
    <ContextMenuContext.Provider value={{ open, setOpen }}>
      {children}
    </ContextMenuContext.Provider>
  );
}

export function ContextMenuTrigger({ children }: { children: ReactNode }) {
  useTheme();
  const { setOpen } = useContext(ContextMenuContext);
  return (
    <Pressable onLongPress={() => setOpen(true)} onPress={() => setOpen(true)}>
      {children}
    </Pressable>
  );
}

export function ContextMenuContent({ children }: { children: ReactNode }) {
  useTheme();
  const { open, setOpen } = useContext(ContextMenuContext);
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => setOpen(false)}
    >
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        <View style={styles.menu}>{children}</View>
      </Pressable>
    </Modal>
  );
}

export function ContextMenuItem({
  children,
  shortcut,
  inset,
  disabled,
  onSelect,
}: {
  children: ReactNode;
  shortcut?: string;
  inset?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const { setOpen } = useContext(ContextMenuContext);
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        onSelect?.();
        setOpen(false);
      }}
      style={[
        styles.item,
        inset && { paddingLeft: 24 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={styles.itemText}>{children}</Text>
      {shortcut ? <Text style={styles.shortcut}>{shortcut}</Text> : null}
    </Pressable>
  );
}

export function ContextMenuLabel({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.label}>{children}</Text>;
}

export function ContextMenuSeparator() {
  useTheme();
  return <View style={styles.sep} />;
}

export function ContextMenuShortcut({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.shortcut}>{children}</Text>;
}

const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    menu: {
      width: 220,
      borderRadius: t.radius.md,
      backgroundColor: t.canvas,
      borderWidth: 0.5,
      borderColor: t.lineStrong,
      padding: 5,
      gap: 2,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: t.radius.xs,
    },
    itemText: {
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 13,
    },
    shortcut: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 11,
    },
    label: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 11,
      fontWeight: "normal",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    sep: {
      height: 0.5,
      backgroundColor: t.line,
      marginVertical: 3,
    },
  };
});
