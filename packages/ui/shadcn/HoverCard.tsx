import { pixelTheme } from "../pixelTheme";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { EdgeModal as Modal } from "../edge";
import { themedStyleSheet, useTheme } from "../theme";

const HoverCardContext = createContext<{
  open: boolean;
  setOpen: (v: boolean) => void;
}>({
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
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => setOpen(false)}
    >
      <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
        <View style={styles.card}>{children}</View>
      </Pressable>
    </Modal>
  );
}

const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(25,21,44,0.46)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    card: {
      width: 280,
      borderRadius: 12,
      backgroundColor: t.canvas,
      borderWidth: 0.5,
      borderColor: t.lineStrong,
      padding: 14,
      gap: 6,
    },
  };
});
