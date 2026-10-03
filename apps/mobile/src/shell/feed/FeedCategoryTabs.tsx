import { useMemo } from "react";
import { Pressable } from "react-native";
import Animated, {
  interpolateColor,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from "react-native-reanimated";
import { KIND_LABEL, kindTone } from "../../../../../packages/ui/feed";
import { PixelText } from "./PixelText";
import { usePixelTheme } from "./pixelTheme";
import type { FeedCategory } from "./useFeedPager";

/** One indicator driven by the native page position, including partial swipes. */
export function FeedCategoryTabs({
  categories,
  selected,
  position,
  onSelect,
}: {
  categories: readonly FeedCategory[];
  selected: FeedCategory;
  position: SharedValue<number>;
  onSelect: (category: FeedCategory) => void;
}) {
  const { colors } = usePixelTheme();
  const tabs = useMemo(
    () =>
      categories.map((category) => ({
        category,
        label:
          category === null
            ? "全部"
            : category === "user"
            ? "用户"
            : KIND_LABEL[category],
        tone:
          category === null
            ? colors.redText
            : category === "user"
            ? colors.cyanText
            : kindTone(category, colors).text,
      })),
    [categories, colors]
  );
  const frames = useSharedValue(
    tabs.map((_tab, index) => ({ x: index * 56, width: 44 }))
  );
  const viewport = useSharedValue(0);
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const indicator = useAnimatedStyle(() => {
    const p = Math.max(0, Math.min(tabs.length - 1, position.value));
    const left = Math.floor(p);
    const right = Math.min(tabs.length - 1, left + 1);
    const t = p - left;
    const x = frames.value[left]?.x ?? 0;
    const nextX = frames.value[right]?.x ?? x;
    return {
      transform: [{ translateX: x + (nextX - x) * t }],
      backgroundColor: interpolateColor(
        t,
        [0, 1],
        [tabs[left].tone, tabs[right].tone]
      ),
    };
  });
  useAnimatedReaction(
    () => ({
      page: position.value,
      frames: frames.value,
      width: viewport.value,
    }),
    (current) => {
      if (current.width <= 0) return;
      const p = Math.max(0, Math.min(tabs.length - 1, current.page));
      const i = Math.floor(p);
      const a = current.frames[i];
      const b = current.frames[Math.min(tabs.length - 1, i + 1)] ?? a;
      if (!a || !b) return;
      const x = a.x + (b.x - a.x) * (p - i);
      const last = current.frames[tabs.length - 1];
      const max = Math.max(
        0,
        (last?.x ?? 0) + (last?.width ?? 0) - current.width
      );
      scrollTo(scroller, Math.max(0, Math.min(max, x - 16)), 0, false);
    },
    [tabs.length]
  );
  return (
    <Animated.ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      onLayout={(event) => {
        viewport.value = event.nativeEvent.layout.width;
      }}
      contentContainerStyle={{
        flexDirection: "row",
        gap: 12,
        position: "relative",
      }}
    >
      {tabs.map((tab, index) => (
        <Pressable
          key={tab.category ?? "all"}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: selected === tab.category }}
          onPress={() => onSelect(tab.category)}
          onLayout={(event) => {
            const { x, width } = event.nativeEvent.layout;
            const next = [...frames.value];
            next[index] = { x, width };
            frames.value = next;
          }}
          style={({ pressed }) => ({
            minWidth: 44,
            height: 44,
            justifyContent: "center",
            paddingBottom: 6,
            backgroundColor: pressed ? colors.inset : "transparent",
          })}
        >
          <PixelText
            style={{
              fontSize: 13,
              lineHeight: 18,
              fontWeight: "500",
              color: selected === tab.category ? tab.tone : colors.ink3,
            }}
          >
            {tab.label}
          </PixelText>
        </Pressable>
      ))}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: "absolute", left: 0, bottom: 6, width: 20, height: 3 },
          indicator,
        ]}
      />
    </Animated.ScrollView>
  );
}
