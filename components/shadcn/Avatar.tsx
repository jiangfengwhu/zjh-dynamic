import { useState } from "react";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

export type AvatarProps = {
  uri?: string;
  fallback?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ uri, fallback = "U", size = 32, style }: AvatarProps) {
  useTheme();
  const [failed, setFailed] = useState(false);

  return (
    <View
      style={[
        styles.root,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          onError={() => setFailed(true)}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={[styles.fallback, { fontSize: Math.max(10, Math.round(size * 0.38)) }]}>
          {fallback.slice(0, 2).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  root: {
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fallback: {
    color: theme.ink2,
    fontWeight: "600",
  },
}));
