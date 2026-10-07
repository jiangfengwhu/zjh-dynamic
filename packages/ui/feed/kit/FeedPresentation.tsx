import { Text } from "../../primitives/Typography";
import { createContext, useContext, type ComponentType } from "react";
import { type TextProps } from "react-native";

/** Shared list edge for compact items and their separators. */
export const COMPACT_FEED_INSET = 7;

/** Host presentation only. No public application/card/data contract changes. */
export const FeedPresentationContext = createContext<{
  Text: ComponentType<TextProps>;
  compact: boolean;
  /** Outer list can own horizontal spacing without changing other consumers. */
  frameInset?: number;
  /** Measured list-row width; avoids rendering HTML at a guessed width. */
  rowWidth?: number;
}>({ Text, compact: false });
export const FeedContentWidthContext = createContext<number | undefined>(undefined);
export function useFeedContentWidth() { return useContext(FeedContentWidthContext); }
export function useFeedRowWidth() { return useContext(FeedPresentationContext).rowWidth; }
export function FeedText(props: TextProps) {
  const { Text: Renderer } = useContext(FeedPresentationContext);
  return <Renderer {...props} />;
}
export function useCompactFeed() {
  return useContext(FeedPresentationContext).compact;
}

export function useFeedFrameInset() {
  const presentation = useContext(FeedPresentationContext);
  return (
    presentation.frameInset ?? (presentation.compact ? COMPACT_FEED_INSET : 14)
  );
}
