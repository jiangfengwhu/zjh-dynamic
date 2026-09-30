import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { EdgeModal as Modal } from "../edge";
import { theme, themedStyleSheet, useTheme } from "../theme";

const HoverCardContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({
  open: false,
  setOpen: () => {},
});

export function HoverCard({ children }: { children: ReactNode }) {
  useTheme();
  const [open, setOpen] = useState(false);
  return (
    <HoverCardContext.Provider value={{ open, setOpen }}>
      {children}
    </HoverCardContext.Provider>
  );
}

export function HoverCardTrigger({ children }: { children: ReactNode }) {
  useTheme();
  const { setOpen } = useContext(HoverCardContext);
  return <Pressable onPress={() => setOpen(true)}>{children}</Pressable>;
}

export function HoverCardContent({ children }: { children: ReactNode }) {
  useTheme();
  const { open, setOpen } = useContext(HoverCardContext);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        <View style={styles.card}>{children}</View>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyleSheet(() => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: 280,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 14,
    gap: 6,
  },
}));
