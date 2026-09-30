import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type AccordionItemData = {
  value: string;
  title: string;
  content: ReactNode;
};

export type AccordionProps = {
  items: AccordionItemData[];
  defaultOpen?: string[];
  type?: "single" | "multiple";
  style?: StyleProp<ViewStyle>;
};

export function Accordion({
  items,
  defaultOpen = [],
  type = "single",
  style,
}: AccordionProps) {
  useTheme();
  const [openValues, setOpenValues] = useState<string[]>(defaultOpen);

  const toggle = (val: string) => {
    setOpenValues((prev) => {
      const exists = prev.includes(val);
      if (type === "single") {
        return exists ? [] : [val];
      }
      return exists ? prev.filter((x) => x !== val) : [...prev, val];
    });
  };

  return (
    <View style={[styles.root, style]}>
      {items.map((item, idx) => {
        const isOpen = openValues.includes(item.value);
        return (
          <View
            key={item.value}
            style={[styles.item, idx < items.length - 1 && styles.itemBorder]}
          >
            <Pressable onPress={() => toggle(item.value)} style={styles.trigger}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.chevron}>{isOpen ? "▴" : "▾"}</Text>
            </Pressable>
            {isOpen ? (
              <View style={styles.content}>
                {typeof item.content === "string" ? (
                  <Text style={styles.contentText}>{item.content}</Text>
                ) : (
                  item.content
                )}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  root: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    backgroundColor: theme.surfaceRaised,
    overflow: "hidden",
  },
  item: {
    paddingHorizontal: 14,
  },
  itemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
  },
  title: {
    color: theme.text,
    fontSize: 13.5,
    fontWeight: "500",
    flex: 1,
  },
  chevron: {
    color: theme.muted,
    fontSize: 12,
  },
  content: {
    paddingBottom: 12,
  },
  contentText: {
    color: theme.muted,
    fontSize: 13,
    lineHeight: 19,
  },
}));
