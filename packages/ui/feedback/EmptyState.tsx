import { View, type ViewProps } from "react-native";

/** Owns remaining content space; it never covers a header or footer. */
export function EmptyState({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 }, style]} />;
}
