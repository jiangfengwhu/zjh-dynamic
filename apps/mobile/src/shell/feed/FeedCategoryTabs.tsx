import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { TabLabel } from "../TabAppearance";
import { useTheme } from "../../../../../packages/ui/theme";
import type { FeedCategory } from "./useFeedPager";

const categories = ["installed", "recommended", "following"] as const;
const labelStyle = { fontSize: 15, lineHeight: 20, fontWeight: "700" as const, letterSpacing: -0.2 };
export function FeedCategoryTabs({
  selected,
  position,
  onSelect,
}: {
  selected: FeedCategory;
  position: SharedValue<number>;
  onSelect: (category: FeedCategory) => void;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const indicator = useAnimatedStyle(() => ({
    transform: [
      { translateX: (Math.max(0, Math.min(2, position.value)) * width) / 3 },
    ],
  }));
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flex: 1, maxWidth: 300, height: 44, flexDirection: "row" }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", top: 3, bottom: 3, left: 0, width: width / 3, paddingHorizontal: 4 },
          indicator,
        ]}
      >
        <View style={{ flex: 1, borderRadius: 19, backgroundColor: colors.accent }} />
      </Animated.View>
      {categories.map((category, index) => (
        <Pressable
          key={category}
          accessibilityRole="tab"
          accessibilityLabel={
            category === "installed" ? "我的应用"
              : category === "recommended" ? "为你推荐" : "正在关注"
          }
          accessibilityState={{ selected: category === selected }}
          onPress={() => onSelect(category)}
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <TabLabel
            label={
              category === "installed" ? "我的应用"
                : category === "recommended" ? "为你推荐" : "正在关注"
            }
            index={index}
            position={position}
            activeColor={colors.onAccent}
            inactiveColor={colors.ink3}
            labelStyle={labelStyle}
          />
        </Pressable>
      ))}
    </View>
  );
}
