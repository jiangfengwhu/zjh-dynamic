import { createElement, forwardRef, useContext, useMemo, type ElementType } from "react";
import type { Theme as CalendarTheme } from "react-native-calendars/src/types";
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

let calendarsModule: typeof import("react-native-calendars") | undefined;
export function applicationCalendarsModule() {
  if (calendarsModule) return calendarsModule;
  const original: typeof import("react-native-calendars") = require("react-native-calendars");
  const replacements: Record<string, unknown> = {};
  for (const name of ["Calendar", "CalendarList", "NewCalendarList", "Agenda", "ExpandableCalendar", "WeekCalendar", "AgendaList", "CalendarProvider"] as const) {
    const Component = original[name];
    const Adapted = forwardRef<unknown, { theme?: CalendarTheme }>(function ApplicationCalendar({ theme, ...props }, ref) {
      const { colors } = useTheme();
      const themed = useMemo(() => {
        const value: CalendarTheme = { ...(theme ?? {}) };
        for (const [familyKey, weightKey] of [
          ["textDayFontFamily", "textDayFontWeight"],
          ["textMonthFontFamily", "textMonthFontWeight"],
          ["textDayHeaderFontFamily", "textDayHeaderFontWeight"],
          ["todayButtonFontFamily", "todayButtonFontWeight"],
        ] as const) {
          value[familyKey] ??= colors.typography.body;
          if (value[familyKey] === "Fusion Pixel 12px Proportional SC") value[weightKey] = "normal";
        }
        return value;
      }, [theme, colors.typography.body]);
      return createElement(Component as ElementType, { ...props, ref, theme: themed });
    });
    // Keep public constants such as ExpandableCalendar.positions, without copying
    // React's memo/forwardRef identity or a class component's lifecycle methods.
    const reserved = new Set(["$$typeof", "render", "compare", "type", "prototype", "name", "length", "caller", "arguments", "getDerivedStateFromProps", "getDerivedStateFromError"]);
    Object.defineProperties(Adapted, Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(Component)).filter(([key]) => !reserved.has(key))));
    replacements[name] = Adapted;
  }
  return calendarsModule = overlay(original, replacements);
}
