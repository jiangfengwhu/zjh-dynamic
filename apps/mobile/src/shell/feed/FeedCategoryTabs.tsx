import { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";
import { PixelText } from "./PixelText";
import { usePixelTheme } from "./pixelTheme";
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
  const { colors } = usePixelTheme();
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
      {categories.map((category) => (
        <Pressable
          key={category}
          accessibilityRole="tab"
          accessibilityState={{ selected: category === selected }}
          onPress={() => onSelect(category)}
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <PixelText
            style={{
              color: selected === category ? colors.ink1 : colors.ink3,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            {category === "installed"
              ? "我的应用"
              : category === "recommended"
              ? "为你推荐"
              : "正在关注"}
          </PixelText>
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
