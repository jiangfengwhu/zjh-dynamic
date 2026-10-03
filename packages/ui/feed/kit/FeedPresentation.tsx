import { createContext, useContext, type ComponentType } from "react";
import { Text, type TextProps } from "react-native";

/** Shared list edge for compact items and their separators. */
export const COMPACT_FEED_INSET = 7;

/** Host presentation only. No public application/card/data contract changes. */
export const FeedPresentationContext = createContext<{
  Text: ComponentType<TextProps>;
  compact: boolean;
}>({ Text, compact: false });
export function FeedText(props: TextProps) {
  const { Text: Renderer } = useContext(FeedPresentationContext);
  return <Renderer {...props} />;
}
export function useCompactFeed() {
  return useContext(FeedPresentationContext).compact;
}
