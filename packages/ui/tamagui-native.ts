import { getSafeArea, setKeyboardControllerState } from "@tamagui/native";
import { useSafeAreaInsets, useSafeAreaFrame, initialWindowMetrics } from "react-native-safe-area-context";
import { KeyboardProvider, KeyboardAwareScrollView, useKeyboardHandler, useReanimatedKeyboardAnimation,
  KeyboardController, KeyboardEvents, KeyboardStickyView } from "react-native-keyboard-controller";

// Explicit imports keep Metro's dependency graph static. Tamagui uses the native
// providers already owned by the host; applications do not install another copy.
getSafeArea().set({ enabled: true, useSafeAreaInsets, useSafeAreaFrame, initialMetrics: initialWindowMetrics });
setKeyboardControllerState({ enabled: true, KeyboardProvider, KeyboardAwareScrollView,
  useKeyboardHandler, useReanimatedKeyboardAnimation, KeyboardController, KeyboardEvents, KeyboardStickyView });
