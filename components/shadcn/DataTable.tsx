import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type DataTableColumn<T> = {
  key: keyof T & string;
  header: string;
  sortable?: boolean;
};

export type DataTableProps<T extends { id: string }> = {
  columns: DataTableColumn<T>[];
  data: T[];
  filterKey?: keyof T & string;
  pageSize?: number;
  style?: StyleProp<ViewStyle>;
};

export function DataTable<T extends { id: string }>({
  columns,
  data,
  filterKey,
  pageSize = 5,
  style,
}: DataTableProps<T>) {
  useTheme();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = [...data];
    if (query.trim() && filterKey) {
      const q = query.trim().toLowerCase();
      list = list.filter((row) =>
        String(row[filterKey] ?? "")
          .toLowerCase()
          .includes(q),
      );
    }
    if (sortKey) {
      list.sort((a, b) => {
        const va = String(a[sortKey as keyof T] ?? "");
        const vb = String(b[sortKey as keyof T] ?? "");
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    return list;
  }, [data, query, filterKey, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSlice = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <View style={[styles.wrap, style]}>
      {filterKey ? (
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setPage(0);
          }}
          placeholder={`Filter ${filterKey}…`}
          placeholderTextColor={theme.ink3}
          style={styles.filterInput}
        />
      ) : null}

      <View style={styles.table}>
        <View style={styles.headRow}>
          <View style={styles.checkCol} />
          {columns.map((col) => (
            <Pressable
              key={col.key}
              disabled={!col.sortable}
              onPress={() => {
                if (sortKey === col.key) setSortAsc((v) => !v);
                else {
                  setSortKey(col.key);
                  setSortAsc(true);
                }
              }}
              style={styles.cell}
            >
              <Text style={styles.headText}>
                {col.header}
                {sortKey === col.key ? (sortAsc ? " ↑" : " ↓") : ""}
              </Text>
            </Pressable>
          ))}
        </View>

        {pageSlice.map((row) => {
          const checked = !!selectedIds[row.id];
          return (
            <View key={row.id} style={styles.row}>
              <View style={styles.checkCol}>
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) =>
                    setSelectedIds((prev) => ({ ...prev, [row.id]: next }))
                  }
                />
              </View>
              {columns.map((col) => (
                <View key={col.key} style={styles.cell}>
                  <Text style={styles.cellText} numberOfLines={1}>
                    {String(row[col.key] ?? "")}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.meta}>
          {Object.values(selectedIds).filter(Boolean).length} of {filtered.length} selected
        </Text>
        <View style={styles.pager}>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 0}
            label="Previous"
            onPress={() => setPage((p) => Math.max(0, p - 1))}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            label="Next"
            onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          />
        </View>
      </View>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  wrap: {
    gap: 10,
  },
  filterInput: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.field,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    color: theme.text,
    fontSize: 13,
  },
  table: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    overflow: "hidden",
  },
  headRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.inset,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
    minHeight: 36,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
    minHeight: 40,
  },
  checkCol: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  cell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headText: {
    color: theme.muted,
    fontSize: 11.5,
    fontWeight: "600",
  },
  cellText: {
    color: theme.text,
    fontSize: 12.5,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  meta: {
    color: theme.muted,
    fontSize: 12,
  },
  pager: {
    flexDirection: "row",
    gap: 6,
  },
}));
