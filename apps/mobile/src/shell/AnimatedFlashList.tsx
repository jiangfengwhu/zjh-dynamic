import { FlashList } from "@shopify/flash-list";
import Animated from "react-native-reanimated";

export const AnimatedFlashList = Animated.createAnimatedComponent(FlashList) as typeof FlashList;
export type { FlashListRef, FlashListProps } from "@shopify/flash-list";
