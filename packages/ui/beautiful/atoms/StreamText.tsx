import { useEffect, useState } from "react";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../../theme";

export type StreamTextProps = {
  text: string;
  speedMs?: number;
  onComplete?: () => void;
  style?: StyleProp<TextStyle>;
};

export function StreamText({
  text,
  speedMs = 35,
  onComplete,
  style,
}: StreamTextProps) {
  useTheme();
  const words = text.split(" ");
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [text]);

  useEffect(() => {
    if (idx >= words.length) {
      onComplete?.();
      return;
    }
    const timer = setTimeout(() => setIdx((i) => i + 1), speedMs);
    return () => clearTimeout(timer);
  }, [idx, words.length, speedMs, onComplete]);

  return (
    <Text style={[styles.text, style]}>
      {words.slice(0, idx).join(" ")}
      {idx < words.length ? <Text style={styles.caret}> ▍</Text> : null}
    </Text>
  );
}

const styles = themedStyleSheet(() => ({
  text: {
    color: theme.text,
    fontSize: 13,
    lineHeight: 19,
  },
  caret: {
    color: theme.accent,
    fontSize: 12,
  },
}));
