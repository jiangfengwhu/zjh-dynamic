import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../../theme";

export type GlideMenuOption = {
  key: string;
  label: string;
  meta?: string;
};

export type GlideMenuProps = {
  options: GlideMenuOption[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function GlideMenu({ options, value, onChange, style }: GlideMenuProps) {
  useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value) ?? options[0];

  return (
    <View style={[styles.wrap, style]}>
      <Pressable onPress={() => setOpen((o) => !o)} style={styles.trigger}>
        <Text style={styles.triggerLabel}>{current?.label ?? value}</Text>
        <Text style={styles.chevron}>{open ? "▴" : "▾"}</Text>
      </Pressable>
      {open ? (
        <View style={styles.menu}>
          {options.map((item) => {
            const active = item.key === value;
            return (
              <Pressable
                key={item.key}
                onPress={() => {
                  onChange(item.key);
                  setOpen(false);
                }}
                style={[styles.row, active && styles.rowActive]}
              >
                <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                  {item.label}
                </Text>
                {item.meta ? <Text style={styles.rowMeta}>{item.meta}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export default GlideMenu;

const styles = themedStyleSheet(() => ({
  wrap: {
    position: "relative",
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  triggerLabel: {
    color: theme.text,
    fontSize: 12,
    fontWeight: "500",
  },
  chevron: {
    color: theme.muted,
    fontSize: 10,
  },
  menu: {
    marginTop: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 4,
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: theme.radius.xs,
  },
  rowActive: {
    backgroundColor: theme.hover,
  },
  rowLabel: {
    color: theme.ink2,
    fontSize: 12,
  },
  rowLabelActive: {
    color: theme.text,
    fontWeight: "600",
  },
  rowMeta: {
    color: theme.muted,
    fontSize: 11,
  },
}));
