import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../../theme";

export type ThemeToggleProps = {
  dark?: boolean;
  onChange?: (dark: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

export function ThemeToggle({ dark: controlledDark, onChange, style }: ThemeToggleProps) {
  const { mode, setMode: setGlobalMode } = useTheme();
  const [internalDark, setInternalDark] = useState(mode === "dark");
  const isDark = controlledDark ?? (onChange ? internalDark : mode === "dark");

  const setMode = (nextDark: boolean) => {
    setInternalDark(nextDark);
    setGlobalMode(nextDark ? "dark" : "light");
    onChange?.(nextDark);
  };

  return (
    <View style={[styles.track, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Light mode"
        onPress={() => setMode(false)}
        style={[styles.btn, !isDark && styles.btnActive]}
      >
        <Text style={[styles.icon, !isDark && styles.iconActive]}>☀</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dark mode"
        onPress={() => setMode(true)}
        style={[styles.btn, isDark && styles.btnActive]}
      >
        <Text style={[styles.icon, isDark && styles.iconActive]}>☾</Text>
      </Pressable>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  track: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.field,
    borderRadius: theme.radius.pill,
    padding: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    alignSelf: "flex-start",
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  btnActive: {
    backgroundColor: theme.surfaceRaised,
  },
  icon: {
    color: theme.ink3,
    fontSize: 13,
  },
  iconActive: {
    color: theme.text,
  },
}));
