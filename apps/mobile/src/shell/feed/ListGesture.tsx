import { cloneElement, useCallback, type ReactElement } from "react";
import type { FlashListProps } from "@shopify/flash-list";
import type { ScrollViewProps } from "react-native";
import Animated from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

/** Bind gesture ownership to FlashList's actual native scroll view. */
export function ListGesture({ gesture, children }: {
  gesture: ReturnType<typeof Gesture.Native>;
  children: ReactElement;
}) {
  const renderScrollComponent = useCallback((props: ScrollViewProps) => (
    <GestureDetector gesture={gesture}><Animated.ScrollView {...props} /></GestureDetector>
  ), [gesture]);
  return cloneElement(children as ReactElement<Pick<FlashListProps<unknown>, "renderScrollComponent">>, { renderScrollComponent });
}
