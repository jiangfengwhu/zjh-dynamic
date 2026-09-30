import { createContext, useContext, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

const SidebarContext = createContext<{ open: boolean; toggleSidebar: () => void }>({
  open: true,
  toggleSidebar: () => {},
});

export function SidebarProvider({
  defaultOpen = true,
  children,
}: {
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <SidebarContext.Provider value={{ open, toggleSidebar: () => setOpen((o) => !o) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function Sidebar({
  variant = "sidebar",
  children,
  style,
}: {
  variant?: "sidebar" | "floating" | "inset";
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  const { open } = useContext(SidebarContext);
  if (!open) return null;
  return (
    <View
      style={[
        styles.sidebar,
        variant === "floating" && styles.floating,
        variant === "inset" && styles.inset,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SidebarTrigger() {
  useTheme();
  const { toggleSidebar } = useContext(SidebarContext);
  return (
    <Pressable onPress={toggleSidebar} style={styles.triggerBtn}>
      <Text style={styles.triggerIcon}>☰</Text>
    </Pressable>
  );
}

export function SidebarHeader({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.header}>{children}</View>;
}

export function SidebarContent({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.content}>{children}</View>;
}

export function SidebarFooter({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.footer}>{children}</View>;
}

export function SidebarGroup({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.group}>{children}</View>;
}

export function SidebarGroupLabel({ children }: { children: ReactNode }) {
  useTheme();
  return <Text style={styles.groupLabel}>{children}</Text>;
}

export function SidebarGroupContent({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.groupContent}>{children}</View>;
}

export function SidebarMenu({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.menu}>{children}</View>;
}

export function SidebarMenuItem({ children }: { children: ReactNode }) {
  useTheme();
  return <View>{children}</View>;
}

export function SidebarMenuButton({
  isActive,
  onPress,
  children,
}: {
  isActive?: boolean;
  onPress?: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.menuBtn, isActive && styles.menuBtnActive]}>
      {typeof children === "string" ? (
        <Text style={[styles.menuBtnText, isActive && styles.menuBtnTextActive]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = themedStyleSheet(() => ({
  sidebar: {
    width: 220,
    backgroundColor: theme.surfaceRaised,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: theme.line,
    padding: 10,
    gap: 10,
  },
  floating: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  inset: {
    backgroundColor: theme.inset,
    borderRadius: theme.radius.lg,
  },
  triggerBtn: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.inset,
    alignItems: "center",
    justifyContent: "center",
  },
  triggerIcon: {
    color: theme.text,
    fontSize: 13,
  },
  header: {
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  footer: {
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.line,
  },
  group: {
    gap: 4,
  },
  groupLabel: {
    color: theme.ink3,
    fontSize: 10.5,
    fontWeight: "600",
    paddingHorizontal: 6,
    textTransform: "uppercase",
  },
  groupContent: {
    gap: 2,
  },
  menu: {
    gap: 2,
  },
  menuBtn: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
  },
  menuBtnActive: {
    backgroundColor: theme.hover,
  },
  menuBtnText: {
    color: theme.ink2,
    fontSize: 12.5,
  },
  menuBtnTextActive: {
    color: theme.text,
    fontWeight: "600",
  },
}));
