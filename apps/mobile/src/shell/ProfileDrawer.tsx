import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BackHandler,
  Pressable,
  View,
  useWindowDimensions,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import { ThemeContext } from "../../../../packages/ui/theme";
import { usePixelTheme } from "./feed/pixelTheme";

const timing = {
  duration: 220,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.Never,
};
let reveal: (() => void) | undefined;
export function showProfileDrawer() {
  reveal?.();
}
type Drawer = {
  progress: SharedValue<number>;
  width: number;
  open: () => void;
  close: () => void;
  startDrag: () => void;
  settle: (open: boolean) => void;
};
const Context = createContext<Drawer | null>(null);
export function useProfileDrawer() {
  const value = useContext(Context);
  if (!value) throw new Error("ProfileDrawer is required");
  return value;
}

/** Drawer and the whole tab surface share one translation, with no route transition. */
export function ProfileDrawer({
  children,
  render,
}: {
  children: ReactNode;
  render: (close: () => void) => ReactNode;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const theme = usePixelTheme();
  const { colors } = theme;
  const drawerTheme = useMemo(
    () => ({ ...theme, colors: { ...colors, surface: colors.canvas } }),
    [theme, colors]
  );
  const width = Math.min(340, screenWidth * 0.84);
  const progress = useSharedValue(0);
  const start = useSharedValue(0);
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const closingActive = useSharedValue(false);
  const focused = useIsFocused();
  const settle = useCallback(
    (next: boolean) => {
      setOpening(false);
      if (next) setOpened(true);
      progress.value = withTiming(next ? 1 : 0, timing, (finished) => {
        if (finished && !next) runOnJS(setOpened)(false);
      });
    },
    [progress]
  );
  const open = useCallback(() => settle(true), [settle]);
  const close = useCallback(() => settle(false), [settle]);
  const startDrag = useCallback(() => {
    setOpening(true);
    setOpened(true);
  }, []);
  useEffect(() => {
    reveal = open;
    return () => {
      if (reveal === open) reveal = undefined;
    };
  }, [open]);
  useEffect(() => {
    if (!opened || !focused) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        close();
        return true;
      }
    );
    return () => subscription.remove();
  }, [opened, focused, close]);
  const value = useMemo(
    () => ({ progress, width, open, close, startDrag, settle }),
    [progress, width, open, close, startDrag, settle]
  );
  const closing = useMemo(
    () =>
      Gesture.Pan()
        .enabled(opened && !opening)
        .activeOffsetX([-8, 8])
        .failOffsetY([-6, 6])
        .onStart(() => {
          closingActive.value = true;
          cancelAnimation(progress);
          start.value = progress.value;
        })
        .onUpdate((event) => {
          progress.value = Math.max(
            0,
            Math.min(1, start.value + event.translationX / width)
          );
        })
        .onEnd((event) => {
          runOnJS(settle)(
            event.velocityX > 500 ||
              (event.velocityX >= -500 && progress.value > 0.5)
          );
        })
        .onFinalize((_event, success) => {
          if (closingActive.value && !success)
            runOnJS(settle)(progress.value > 0.5);
          closingActive.value = false;
        }),
    [opened, opening, progress, start, width, settle, closingActive]
  );
  const surface = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * width }],
  }));
  const panel = useAnimatedStyle(() => ({
    transform: [{ translateX: -width * 0.15 * (1 - progress.value) }],
    opacity: progress.value,
  }));
  const shade = useAnimatedStyle(() => ({ opacity: progress.value * 0.28 }));
  return (
    <Context.Provider value={value}>
      <GestureDetector gesture={closing}>
        <View
          style={{
            flex: 1,
            overflow: "hidden",
            backgroundColor: colors.canvas,
          }}
        >
          <Animated.View
            pointerEvents={opened ? "auto" : "none"}
            accessibilityElementsHidden={!opened}
            importantForAccessibility={opened ? "yes" : "no-hide-descendants"}
            accessibilityViewIsModal={opened}
            style={[
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width,
                overflow: "hidden",
                backgroundColor: colors.canvas,
              },
              panel,
            ]}
          >
            <ThemeContext.Provider value={drawerTheme}>
              {render(close)}
            </ThemeContext.Provider>
          </Animated.View>
          <Animated.View
            style={[
              { flex: 1, overflow: "hidden", backgroundColor: colors.canvas },
              surface,
            ]}
          >
            <View
              style={{ flex: 1 }}
              accessibilityElementsHidden={opened}
              importantForAccessibility={
                opened ? "no-hide-descendants" : "auto"
              }
            >
              {children}
            </View>
            {opened ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="关闭我的抽屉"
                onPress={close}
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  right: 0,
                  zIndex: 100,
                }}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[{ flex: 1, backgroundColor: "#19152C" }, shade]}
                />
              </Pressable>
            ) : null}
          </Animated.View>
        </View>
      </GestureDetector>
    </Context.Provider>
  );
}
