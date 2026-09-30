import { View } from "react-native";
import { Icon } from "../../ui/chrome";
import { useTheme } from "../../ui/theme";
import type { AppAvatarProps } from "./types";

export function HabitAvatar({ size }: AppAvatarProps) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.orangeTint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon name="sun" size={size * 0.55} color={colors.orange} />
    </View>
  );
}
