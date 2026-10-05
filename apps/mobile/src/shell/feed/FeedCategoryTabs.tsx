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
      style={{ flex: 1, height: 44, flexDirection: "row" }}
    >
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
            activeColor={colors.ink1}
            inactiveColor={colors.ink3}
          />
        </Pressable>
      ))}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            bottom: 0,
            left: 0,
            width: width / 3,
            alignItems: "center",
          },
          indicator,
        ]}
      >
        <View
          style={{
            width: 28,
            height: 3,
            borderRadius: 2,
            backgroundColor: colors.accent,
          }}
        />
      </Animated.View>
    </View>
  );
}
