import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * SIDEBAR NAV
 * Collapsible workspace and chat navigation with active states.
 * ───────────────────────────────────────────────────────── */

export type SidebarNavItem = {
  id: string;
  label: string;
  icon?: string;
  badge?: string;
  section?: string;
};

const DEFAULT_ITEMS: SidebarNavItem[] = [
  { id: "inbox", label: "Agent Inbox", icon: "◈", badge: "3", section: "Workspace" },
  { id: "workflows", label: "Automations", icon: "⚡", section: "Workspace" },
  { id: "records", label: "Creamery CRM", icon: "▤", section: "Workspace" },
  { id: "chat-1", label: "Q4 Pistachio Velocity", icon: "•", section: "Recent Threads" },
  { id: "chat-2", label: "Cone King Restock PO", icon: "•", section: "Recent Threads" },
];

export type SidebarNavProps = {
  workspaceName?: string;
  items?: SidebarNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function SidebarNav({
  workspaceName = "Alpine Creamery",
  items = DEFAULT_ITEMS,
  activeId: controlledActive,
  onSelect,
  style,
}: SidebarNavProps) {
  useTheme();
  const [activeId, setActiveId] = useState(controlledActive ?? items[0]?.id ?? "");
  const [collapsed, setCollapsed] = useState(false);

  const sections = Array.from(new Set(items.map((i) => i.section ?? "Main")));

  return (
    <View style={[styles.nav, collapsed && styles.navCollapsed, style]}>
      <Pressable
        onPress={() => setCollapsed((c) => !c)}
        style={styles.workspaceHeader}
      >
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>{workspaceName.slice(0, 1)}</Text>
        </View>
        {!collapsed ? (
          <Text style={styles.workspaceTitle} numberOfLines={1}>
            {workspaceName}
          </Text>
        ) : null}
        <Text style={styles.collapseIcon}>{collapsed ? "»" : "«"}</Text>
      </Pressable>

      {sections.map((sec) => (
        <View key={sec} style={styles.section}>
          {!collapsed ? <Text style={styles.sectionTitle}>{sec}</Text> : null}
          {items
            .filter((i) => (i.section ?? "Main") === sec)
            .map((item) => {
              const selected = item.id === activeId;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setActiveId(item.id);
                    onSelect?.(item.id);
                  }}
                  style={[styles.item, selected && styles.itemSelected]}
                >
                  <Text style={[styles.icon, selected && styles.iconSelected]}>
                    {item.icon ?? "•"}
                  </Text>
                  {!collapsed ? (
                    <>
                      <Text
                        style={[styles.label, selected && styles.labelSelected]}
                        numberOfLines={1}
                      >
                        {item.label}
                      </Text>
                      {item.badge ? (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{item.badge}</Text>
                        </View>
                      ) : null}
                    </>
                  ) : null}
                </Pressable>
              );
            })}
        </View>
      ))}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  nav: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    padding: 10,
    gap: 10,
  },
  navCollapsed: {
    width: 54,
    alignItems: "center",
  },
  workspaceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  logoMark: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  workspaceTitle: {
    flex: 1,
    color: theme.text,
    fontSize: 13,
    fontWeight: "600",
  },
  collapseIcon: {
    color: theme.muted,
    fontSize: 13,
  },
  section: {
    gap: 2,
  },
  sectionTitle: {
    color: theme.ink3,
    fontSize: 10.5,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingBottom: 2,
    textTransform: "uppercase",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
  },
  itemSelected: {
    backgroundColor: theme.hover,
  },
  icon: {
    color: theme.muted,
    fontSize: 12,
    width: 14,
    textAlign: "center",
  },
  iconSelected: {
    color: theme.text,
  },
  label: {
    flex: 1,
    color: theme.ink2,
    fontSize: 12.5,
  },
  labelSelected: {
    color: theme.text,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.accentTint,
  },
  badgeText: {
    color: theme.accentText,
    fontSize: 10.5,
    fontWeight: "600",
  },
}));
