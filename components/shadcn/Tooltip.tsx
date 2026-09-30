import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type TooltipProps = {
  content: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Tooltip({ content, children, style }: TooltipProps) {
  useTheme();
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrap, style]}>
      {visible ? (
        <View style={styles.bubble}>
          <Text style={styles.text}>{content}</Text>
        </View>
      ) : null}
      <Pressable
        onPressIn={() => setVisible(true)}
        onPressOut={() => setVisible(false)}
      >
        {children}
      </Pressable>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  wrap: {
    position: "relative",
    alignSelf: "flex-start",
  },
  bubble: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.text,
    zIndex: 20,
  },
  text: {
    color: theme.ink,
    fontSize: 11,
    fontWeight: "600",
  },
}));
