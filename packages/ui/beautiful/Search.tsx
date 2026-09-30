import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * SEARCH
 * Command search with live filtering and an empty state.
 * ───────────────────────────────────────────────────────── */

export type SearchCommandItem = {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
};

const DEFAULT_ITEMS: SearchCommandItem[] = [
  { id: "s1", title: "Churn Saturday Pistachio Batch", category: "Workflows", shortcut: "⌘P" },
  { id: "s2", title: "Reorder Waffle Cones (Cone King)", category: "Actions", shortcut: "⌘R" },
  { id: "s3", title: "Inspect Q4 Margin Velocity", category: "Analytics", shortcut: "⌘M" },
  { id: "s4", title: "Verify Cold-Chain Certificate", category: "Compliance", shortcut: "⌘C" },
];

export type SearchProps = {
  items?: SearchCommandItem[];
  placeholder?: string;
  onSelect?: (item: SearchCommandItem) => void;
  style?: StyleProp<ViewStyle>;
};

export function Search({
  items = DEFAULT_ITEMS,
  placeholder = "Search commands, flavors, or suppliers…",
  onSelect,
  style,
}: SearchProps) {
  useTheme();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <View style={[styles.card, style]}>
      <View style={styles.inputBar}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={theme.ink3}
          style={styles.input}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        ) : (
          <View style={styles.kbd}>
            <Text style={styles.kbdText}>⌘K</Text>
          </View>
        )}
      </View>

      {results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No matching commands</Text>
          <Text style={styles.emptySub}>
            Try searching for “Pistachio”, “Cone King”, or “Margin”.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {results.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => onSelect?.(item)}
              style={styles.row}
            >
              <View style={styles.rowBody}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.category}>{item.category}</Text>
              </View>
              {item.shortcut ? (
                <View style={styles.kbd}>
                  <Text style={styles.kbdText}>{item.shortcut}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    overflow: "hidden",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
    backgroundColor: theme.surface,
  },
  searchIcon: {
    color: theme.muted,
    fontSize: 15,
  },
  input: {
    flex: 1,
    color: theme.text,
    fontSize: 13.5,
    paddingVertical: 4,
  },
  clearBtn: {
    padding: 4,
  },
  clearText: {
    color: theme.muted,
    fontSize: 11,
  },
  kbd: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  kbdText: {
    color: theme.muted,
    fontSize: 10.5,
    fontWeight: "600",
  },
  list: {
    padding: 6,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "500",
  },
  category: {
    color: theme.muted,
    fontSize: 11,
  },
  empty: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: "center",
    gap: 4,
  },
  emptyTitle: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "600",
  },
  emptySub: {
    color: theme.muted,
    fontSize: 12,
    textAlign: "center",
  },
}));
