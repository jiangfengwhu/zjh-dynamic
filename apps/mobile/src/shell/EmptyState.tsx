import { StyleSheet, View, type ViewProps } from "react-native";

/** Fill the remaining list or page content without covering headers or actions. */
export function EmptyState({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.root, style]} />;
}

const styles = StyleSheet.create({
  root: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
});
