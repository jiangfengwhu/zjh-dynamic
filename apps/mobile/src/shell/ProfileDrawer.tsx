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
  feedActive: SharedValue<boolean>;
  feedPage: SharedValue<number>;
  feedPosition: SharedValue<number>;
  feedIdle: SharedValue<boolean>;
  profileActive: SharedValue<boolean>;
  profilePosition: SharedValue<number>;
  marketActive: SharedValue<boolean>;
  marketPosition: SharedValue<number>;
  gesture: ReturnType<typeof Gesture.Pan>;
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

/** One overlay drawer and opening gesture for every main tab. */
export function ProfileDrawer({
  children,
  render,
}: {
  children: ReactNode;
  render: (close: () => void, dismiss: () => void) => ReactNode;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const theme = usePixelTheme();
  const { colors } = theme;
  const drawerTheme = useMemo(
    () => ({ ...theme, colors: { ...colors, surface: colors.canvas } }),
    [theme, colors],
  );
  const width = Math.min(340, screenWidth * 0.84);
  const feedActive = useSharedValue(false);
  const feedPage = useSharedValue(0);
  const feedPosition = useSharedValue(0);
  const feedIdle = useSharedValue(true);
  const profileActive = useSharedValue(false);
  const profilePosition = useSharedValue(0);
  const marketActive = useSharedValue(false);
  const marketPosition = useSharedValue(0);
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
    [progress],
  );
  const open = useCallback(() => settle(true), [settle]);
  const close = useCallback(() => settle(false), [settle]);
  const dismiss = useCallback(() => {
    cancelAnimation(progress);
    progress.value = 0;
    setOpening(false);
    setOpened(false);
  }, [progress]);
  const drawerContent = useMemo(
    () => render(close, dismiss),
    [render, close, dismiss],
  );
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
      },
    );
    return () => subscription.remove();
  }, [opened, focused, close]);
  const canOpen = useSharedValue(focused && !opened);
  useEffect(() => {
    canOpen.value = focused && !opened;
  }, [focused, opened, canOpen]);
  const origin = useSharedValue({ x: 0, y: 0 });
  const active = useSharedValue(false);
  const eligible = useSharedValue(false);
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .maxPointers(1)
        .onTouchesDown((event, manager) => {
          active.value = false;
          // Ownership is decided once per touch from the actual native edge.
          // Idle can arrive after the final frame, or turn dragging for this
          // very touch, so it must not veto an edge-originating drawer drag.
          eligible.value =
            canOpen.value &&
            (!profileActive.value ||
              Math.abs(profilePosition.value) <= 0.001) &&
            (!marketActive.value || Math.abs(marketPosition.value) <= 0.001) &&
            (!feedActive.value ||
              (feedPage.value === 0 && Math.abs(feedPosition.value) <= 0.001));
          const touch = event.allTouches[0];
          if (!eligible.value || !touch || event.numberOfTouches !== 1) {
            manager.fail();
            return;
          }
          origin.value = { x: touch.absoluteX, y: touch.absoluteY };
        })
        .onTouchesMove((event, manager) => {
          if (active.value) return;
          const touch = event.allTouches[0];
          if (!eligible.value || !touch || event.numberOfTouches !== 1) {
            manager.fail();
            return;
          }
          const dx = touch.absoluteX - origin.value.x;
          const dy = Math.abs(touch.absoluteY - origin.value.y);
          if (dx < -4 || (dy > 4 && dy >= Math.abs(dx))) manager.fail();
          else if (dx > 6 && dx > dy * 1.3) manager.activate();
        })
        .onTouchesUp((_event, manager) => {
          if (!active.value) manager.fail();
        })
        .onStart(() => {
          active.value = true;
          cancelAnimation(progress);
          runOnJS(startDrag)();
        })
        .onUpdate((event) => {
          progress.value = Math.max(0, Math.min(1, event.translationX / width));
        })
        .onEnd((event) => {
          runOnJS(settle)(
            event.velocityX > 500 ||
              (event.velocityX >= -500 && progress.value > 0.4),
          );
        })
        .onFinalize((_event, success) => {
          if (active.value && !success) runOnJS(settle)(false);
          active.value = false;
        }),
    [
      canOpen,
      feedActive,
      feedPage,
      feedPosition,
      profileActive,
      profilePosition,
      marketActive,
      marketPosition,
      eligible,
      origin,
      active,
      progress,
      width,
      startDrag,
      settle,
    ],
  );
  const value = useMemo(
    () => ({
      feedActive,
      feedPage,
      feedPosition,
      feedIdle,
      profileActive,
      profilePosition,
      marketActive,
      marketPosition,
      gesture,
      progress,
      width,
      open,
      close,
      startDrag,
      settle,
    }),
    [
      feedActive,
      feedPage,
      feedPosition,
      feedIdle,
      profileActive,
      profilePosition,
      marketActive,
      marketPosition,
      gesture,
      progress,
      width,
      open,
      close,
      startDrag,
      settle,
    ],
  );
  const canClose = useSharedValue(false);
  useEffect(() => {
    canClose.value = opened && !opening;
  }, [opened, opening, canClose]);
  const closing = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .maxPointers(1)
        .onTouchesDown((event, manager) => {
          closingActive.value = false;
          const touch = event.allTouches[0];
          if (!canClose.value || !touch || event.numberOfTouches !== 1) {
            manager.fail();
            return;
          }
          origin.value = { x: touch.absoluteX, y: touch.absoluteY };
        })
        .onTouchesMove((event, manager) => {
          if (closingActive.value) return;
          const touch = event.allTouches[0];
          if (!touch || event.numberOfTouches !== 1) {
            manager.fail();
            return;
          }
          const dx = Math.abs(touch.absoluteX - origin.value.x);
          const dy = Math.abs(touch.absoluteY - origin.value.y);
          if (dy > 4 && dy >= dx) manager.fail();
          else if (dx > 6 && dx > dy * 1.3) manager.activate();
        })
        .onTouchesUp((_event, manager) => {
          if (!closingActive.value) manager.fail();
        })
        .onStart(() => {
          closingActive.value = true;
          cancelAnimation(progress);
          start.value = progress.value;
        })
        .onUpdate((event) => {
          progress.value = Math.max(
            0,
            Math.min(1, start.value + event.translationX / width),
          );
        })
        .onEnd((event) => {
          runOnJS(settle)(
            event.velocityX > 500 ||
              (event.velocityX >= -500 && progress.value > 0.5),
          );
        })
        .onFinalize((_event, success) => {
          if (closingActive.value && !success)
            runOnJS(settle)(progress.value > 0.5);
          closingActive.value = false;
        }),
    [canClose, origin, progress, start, width, settle, closingActive],
  );
  const drawerGestures = useMemo(
    () => Gesture.Simultaneous(gesture, closing),
    [gesture, closing],
  );
  const panel = useAnimatedStyle(() => ({
    transform: [{ translateX: -width * (1 - progress.value) }],
  }));
  const shade = useAnimatedStyle(() => ({ opacity: progress.value * 0.28 }));
  return (
    <Context.Provider value={value}>
      <GestureDetector gesture={drawerGestures}>
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
                zIndex: 200,
                borderTopRightRadius: 24,
                borderBottomRightRadius: 24,
                overflow: "hidden",
                backgroundColor: colors.canvas,
              },
              panel,
            ]}
          >
            <ThemeContext.Provider value={drawerTheme}>
              {drawerContent}
            </ThemeContext.Provider>
          </Animated.View>
          <Animated.View
            style={[
              { flex: 1, overflow: "hidden", backgroundColor: colors.canvas },
            ]}
          >
            <View
              collapsable={false}
              style={{ flex: 1 }}
              accessibilityElementsHidden={opened}
              importantForAccessibility={
                opened ? "no-hide-descendants" : "auto"
              }
            >
              {children}
            </View>
            <Pressable
              pointerEvents={opened ? "auto" : "none"}
              accessibilityElementsHidden={!opened}
              importantForAccessibility={opened ? "yes" : "no-hide-descendants"}
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
          </Animated.View>
        </View>
      </GestureDetector>
    </Context.Provider>
  );
}
