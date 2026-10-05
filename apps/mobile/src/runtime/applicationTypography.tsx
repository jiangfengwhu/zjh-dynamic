import { forwardRef, useContext } from "react";
import type { Text as NativeTextRef, TextInput as NativeInputRef, TextProps, TextInputProps } from "react-native";
import { TextFontContext } from "../../../../packages/ui/primitives/Typography";
import { useTheme } from "../../../../packages/ui/theme";

const Native: typeof import("react-native") = require("react-native");
const OriginalText = Native.Text;
const OriginalInput = Native.TextInput;

// Font-only defaults preserve native sizing, colors, nested text and input APIs.
const ApplicationText = forwardRef<NativeTextRef, TextProps>(function ApplicationText({ style, children, ...props }, ref) {
  const { colors } = useTheme();
  const inherited = useContext(TextFontContext);
  const family = Native.StyleSheet.flatten(style)?.fontFamily ?? inherited ?? colors.typography.body;
  return <OriginalText {...props} ref={ref} style={[
    { fontFamily: family }, style,
    family === "Fusion Pixel 12px Proportional SC" && { fontWeight: "normal", fontStyle: "normal" },
  ]}><TextFontContext.Provider value={family}>{children}</TextFontContext.Provider></OriginalText>;
});
const ApplicationInput = Object.assign(forwardRef<NativeInputRef, TextInputProps>(function ApplicationInput({ style, ...props }, ref) {
  const { colors } = useTheme();
  const family = Native.StyleSheet.flatten(style)?.fontFamily ?? colors.typography.body;
  return <OriginalInput {...props} ref={ref} style={[
    { fontFamily: family }, style,
    family === "Fusion Pixel 12px Proportional SC" && { fontWeight: "normal", fontStyle: "normal" },
  ]} />;
}), { State: OriginalInput.State });

/** Copy export descriptors without eagerly evaluating native module getters. */
function overlay<T extends object>(base: T, replacements: Record<string, unknown>): T {
  return Object.create(Object.getPrototypeOf(base), {
    ...Object.getOwnPropertyDescriptors(base),
    ...Object.fromEntries(Object.entries(replacements).map(([name, value]) => [name, { value, enumerable: true, configurable: true }])),
  });
}
let nativeModule: typeof Native | undefined;
export function applicationNativeModule() {
  return nativeModule ??= overlay(Native, {
    Text: ApplicationText, TextInput: ApplicationInput,
    Animated: overlay(Native.Animated, {
      Text: Native.Animated.createAnimatedComponent(ApplicationText),
      TextInput: Native.Animated.createAnimatedComponent(ApplicationInput),
    }),
  });
}
let reanimatedModule: typeof import("react-native-reanimated") | undefined;
export function applicationReanimatedModule() {
  if (reanimatedModule) return reanimatedModule;
  const original: typeof import("react-native-reanimated") = require("react-native-reanimated");
  const typography = {
    Text: original.createAnimatedComponent(ApplicationText),
    TextInput: original.createAnimatedComponent(ApplicationInput),
  };
  return reanimatedModule = overlay(original, { ...typography, default: overlay(original.default, typography) });
}
