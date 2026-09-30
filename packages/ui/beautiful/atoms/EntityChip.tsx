import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../../theme";

export type EntityChipProps = {
  name: string;
  color?: string;
  prefix?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function EntityChip({
  name,
  color = theme.accent,
  prefix = "@",
  onPress,
  style,
}: EntityChipProps) {
  useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={[styles.chip, style]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.text}>
        {prefix}
        {name}
      </Text>
    </Pressable>
  );
}

const styles = themedStyleSheet(() => ({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    color: theme.text,
    fontSize: 12,
    fontWeight: "500",
  },
}));
