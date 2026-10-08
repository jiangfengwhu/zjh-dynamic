import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { useTheme } from "../theme";

/**
 * 页面氛围底：canvas 上叠几团糖果色光晕，固定在页面上不随内容滚动。
 * 光晕纵向只按距页面顶部的像素定位，与页面高度无关。
 */
export function Ambient() {
  const { colors } = useTheme();
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { experimental_backgroundImage: colors.ambient }]} />;
}

/**
 * 悬浮在滚动内容之上的不透明遮罩用它代替纯色底，复刻出与页面完全对齐的同一块氛围底。
 * offset 是遮罩上沿距页面顶部的距离；遮罩自身有纵向位移时，把位移量（向上为正）传给 shift 抵消。
 */
export function AmbientFill({ offset = 0, shift }: { offset?: number; shift?: SharedValue<number> }) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const motion = useAnimatedStyle(() => ({ transform: [{ translateY: shift ? shift.value : 0 }] }));
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: "hidden", backgroundColor: colors.canvas }]}>
      <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: -offset, height: height + offset, experimental_backgroundImage: colors.ambient }, motion]} />
    </View>
  );
}
