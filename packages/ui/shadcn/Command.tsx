import { pixelTheme, usePixelTheme } from "../pixelTheme";
import { createContext, useContext, useState, type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { EdgeModal as Modal } from "../edge";
import { themedStyleSheet, useTheme } from "../theme";

const CommandContext = createContext<{
  query: string;
  setQuery: (q: string) => void;
}>({
  query: "",
  setQuery: () => {},
});

export function Command({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  const [query, setQuery] = useState("");
  return (
    <CommandContext.Provider value={{ query, setQuery }}>
      <View style={[styles.root, style]}>{children}</View>
    </CommandContext.Provider>
  );
}

export function CommandDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => onOpenChange(false)}
    >
      <Pressable style={styles.backdrop} onPress={() => onOpenChange(false)}>
        <Pressable
          style={styles.dialogWrap}
          onPress={(e) => e.stopPropagation()}
        >
          <Command>{children}</Command>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function CommandInput({
  placeholder = "Type a command or search…",
}: {
  placeholder?: string;
}) {
  useTheme();
  const { colors } = usePixelTheme();
  const { query, setQuery } = useContext(CommandContext);
  return (
    <View style={styles.inputRow}>
      <Text style={styles.searchIcon}>⌕</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={placeholder}
        placeholderTextColor={colors.ink3}
        style={styles.input}
      />
    </View>
  );
}

export function CommandList({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.list}>{children}</View>;
}

export function CommandEmpty({
  children = "No results found.",
}: {
  children?: ReactNode;
}) {
  useTheme();
  return <Text style={styles.empty}>{children}</Text>;
}

export function CommandGroup({
  heading,
  children,
}: {
  heading?: string;
  children: ReactNode;
}) {
  useTheme();
  return (
    <View style={styles.group}>
      {heading ? <Text style={styles.heading}>{heading}</Text> : null}
      {children}
    </View>
  );
}

export function CommandItem({
  value,
  onSelect,
  children,
}: {
  value?: string;
  onSelect?: () => void;
  children: ReactNode;
}) {
  const { query } = useContext(CommandContext);
  if (query && value && !value.toLowerCase().includes(query.toLowerCase())) {
    return null;
  }
  return (
    <Pressable onPress={onSelect} style={styles.item}>
      {typeof children === "string" ? (
        <Text style={styles.itemText}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

export function CommandShortcut({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.shortcut}>{children}</Text>;
}

export function CommandSeparator() {
  useTheme();
  return <View style={styles.sep} />;
}

const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    root: {
      borderRadius: 12,
      backgroundColor: t.canvas,
      borderWidth: 0.5,
      borderColor: t.lineStrong,
      overflow: "hidden",
    },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(25,21,44,0.46)",
      justifyContent: "center",
      padding: 20,
    },
    dialogWrap: {
      width: "100%",
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderBottomWidth: 0.5,
      borderBottomColor: t.line,
    },
    searchIcon: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 14,
    },
    input: {
      flex: 1,
      color: t.ink1,
      fontFamily: t.mono,
      fontSize: 13.5,
      paddingVertical: 4,
    },
    list: {
      padding: 6,
      gap: 4,
    },
    empty: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 12.5,
      textAlign: "center",
      paddingVertical: 14,
    },
    group: {
      gap: 2,
    },
    heading: {
      color: t.ink3,
      fontFamily: t.mono,
      fontSize: 11,
      fontWeight: "normal",
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: t.radius.sm,
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
      marginLeft: "auto",
    },
    sep: {
      height: 0.5,
      backgroundColor: t.line,
      marginVertical: 4,
    },
  };
});
