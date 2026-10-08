import { View, type ViewProps } from "react-native";

/** Owns remaining content space; it never covers a header or footer. */
export function EmptyState({ style, ...props }: ViewProps) {
  return <View {...props} style={[{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32, paddingVertical: 36, gap: 10 }, style]} />;
}
