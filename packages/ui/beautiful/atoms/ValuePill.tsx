import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../../theme";

export type ValuePillTone = "neutral" | "positive" | "negative" | "accent" | "warning";

export type ValuePillProps = {
  value: string;
  tone?: ValuePillTone;
  style?: StyleProp<ViewStyle>;
};

export function ValuePill({ value, tone = "neutral", style }: ValuePillProps) {
  useTheme();
  return (
    <View style={[styles.pill, styles[tone], style]}>
      <Text
        style={[
          styles.text,
          tone === "positive" && styles.textPositive,
          tone === "negative" && styles.textNegative,
          tone === "accent" && styles.textAccent,
          tone === "warning" && styles.textWarning,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  neutral: {
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  positive: {
    backgroundColor: theme.greenTint,
  },
  negative: {
    backgroundColor: theme.redTint,
  },
  accent: {
    backgroundColor: theme.accentTint,
  },
  warning: {
    backgroundColor: theme.orangeTint,
  },
  text: {
    color: theme.ink1,
    fontSize: 11.5,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  textPositive: {
    color: theme.greenText,
  },
  textNegative: {
    color: theme.redText,
  },
  textAccent: {
    color: theme.accentText,
  },
  textWarning: {
    color: theme.orangeText,
  },
}));
