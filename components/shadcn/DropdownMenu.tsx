import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EdgeModal as Modal } from "../edge";
import { theme, themedStyleSheet, useTheme } from "../theme";

const DropdownContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function DropdownMenu({ children }: { children: ReactNode }) {
  useTheme();
  const [open, setOpen] = useState(false);
  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      {children}
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({ children }: { children: ReactNode }) {
  useTheme();
  const { setOpen } = useContext(DropdownContext);
  return <Pressable onPress={() => setOpen(true)}>{children}</Pressable>;
}

export function DropdownMenuContent({ children }: { children: ReactNode }) {
  useTheme();
  const { open, setOpen } = useContext(DropdownContext);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        <View style={styles.menu}>{children}</View>
      </Pressable>
    </Modal>
  );
}

export function DropdownMenuGroup({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.group}>{children}</View>;
}

export function DropdownMenuItem({
  children,
  variant = "default",
  shortcut,
  disabled,
  onSelect,
}: {
  children: ReactNode;
  variant?: "default" | "destructive";
  shortcut?: string;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const { setOpen } = useContext(DropdownContext);
  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        onSelect?.();
        setOpen(false);
      }}
      style={[styles.item, disabled && { opacity: 0.4 }]}
    >
      <Text
        style={[
          styles.itemText,
          variant === "destructive" && { color: theme.redText },
        ]}
      >
        {children}
      </Text>
      {shortcut ? <Text style={styles.shortcut}>{shortcut}</Text> : null}
    </Pressable>
  );
}

export function DropdownMenuCheckboxItem({
  checked,
  onCheckedChange,
  children,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={() => onCheckedChange(!checked)} style={styles.item}>
      <Text style={styles.check}>{checked ? "✓" : " "}</Text>
      <Text style={styles.itemText}>{children}</Text>
    </Pressable>
  );
}

export function DropdownMenuLabel({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.label}>{children}</Text>;
}

export function DropdownMenuSeparator() {
  useTheme();
  return <View style={styles.sep} />;
}

export function DropdownMenuShortcut({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.shortcut}>{children}</Text>;
}

const styles = themedStyleSheet(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  menu: {
    width: 220,
    borderRadius: theme.radius.md,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 5,
    gap: 2,
  },
  group: {
    gap: 2,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: theme.radius.xs,
  },
  itemText: {
    flex: 1,
    color: theme.text,
    fontSize: 13,
  },
  check: {
    width: 14,
    color: theme.text,
    fontSize: 12,
    fontWeight: "700",
  },
  shortcut: {
    color: theme.muted,
    fontSize: 11,
  },
  label: {
    color: theme.ink3,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.line,
    marginVertical: 3,
  },
}));
