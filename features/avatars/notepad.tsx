import { Text, View, StyleSheet } from "react-native";
import { Icon } from "../../components/chrome";
import { useTheme } from "../../components/theme";
import type { AppAvatarProps } from "./types";

export function NotepadAvatar({ size }: AppAvatarProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size * 0.25,
          backgroundColor: colors.orchid,
        },
      ]}
    >
      <Icon name="edit" size={size * 0.6} color={colors.onAccent} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
