import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { TabLabel } from "../TabAppearance";
import { useTheme } from "../../../../../packages/ui/theme";
import type { FeedCategory } from "./useFeedPager";

const categories = ["recommended", "following"] as const;
const labelStyle = { fontSize: 14, lineHeight: 19, fontWeight: "700" as const, letterSpacing: -0.2 };
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
      { translateX: (Math.max(0, Math.min(1, position.value)) * width) / 2 },
    ],
  }));
  // 每个分类一种糖果色，滑块颜色随分页进度连续过渡。
  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      Math.max(0, Math.min(1, position.value)),
      [0, 1],
      [colors.accent, colors.orchid],
    ),
  }));
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ flex: 1, maxWidth: 280, height: 36, flexDirection: "row" }}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", top: 2, bottom: 2, left: 0, width: width / 2, paddingHorizontal: 3 },
          indicator,
        ]}
      >
        <Animated.View style={[{ flex: 1, borderRadius: 16 }, fill]} />
      </Animated.View>
      {categories.map((category, index) => (
        <Pressable
          key={category}
          accessibilityRole="tab"
          accessibilityLabel={
            category === "recommended" ? "为你推荐" : "正在关注"
          }
          accessibilityState={{ selected: category === selected }}
          onPress={() => onSelect(category)}
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <TabLabel
            label={
              category === "recommended" ? "为你推荐" : "正在关注"
            }
            index={index}
            position={position}
            activeColor="#FFFFFF"
            inactiveColor={colors.ink3}
            labelStyle={labelStyle}
          />
        </Pressable>
      ))}
    </View>
  );
}
