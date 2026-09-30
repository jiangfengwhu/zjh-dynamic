import { useRef, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type InputOTPProps = {
  value: string;
  maxLength?: number;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function InputOTP({
  value,
  maxLength = 6,
  onChange,
  style,
}: InputOTPProps) {
  useTheme();
  const inputRef = useRef<TextInput>(null);

  return (
    <Pressable onPress={() => inputRef.current?.focus()} style={[styles.root, style]}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(txt) => onChange(txt.slice(0, maxLength))}
        maxLength={maxLength}
        keyboardType="number-pad"
        style={styles.hiddenInput}
      />
      <InputOTPGroup>
        {Array.from({ length: maxLength }).map((_, idx) => (
          <InputOTPSlot
            key={idx}
            char={value[idx] ?? ""}
            active={idx === value.length}
          />
        ))}
      </InputOTPGroup>
    </Pressable>
  );
}

export function InputOTPGroup({ children }: { children: ReactNode }) {
  useTheme();
  return <View style={styles.group}>{children}</View>;
}

export function InputOTPSlot({
  char,
  active,
}: {
  char?: string;
  active?: boolean;
}) {
  useTheme();
  return (
    <View style={[styles.slot, active && styles.slotActive]}>
      <Text style={styles.char}>{char}</Text>
    </View>
  );
}

export function InputOTPSeparator() {
  useTheme();
  return <Text style={styles.sep}>-</Text>;
}

const styles = themedStyleSheet(() => ({
  root: {
    alignSelf: "flex-start",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  slot: {
    width: 36,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.field,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  slotActive: {
    borderColor: theme.text,
  },
  char: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  sep: {
    color: theme.muted,
    fontSize: 14,
  },
}));
