import { View } from "react-native";
import { Icon } from "../../ui/chrome";
import { useTheme } from "../../ui/theme";
import type { AppAvatarProps } from "./types";

export function PomodoroAvatar({ size }: AppAvatarProps) {
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
        borderWidth: 1,
        borderColor: colors.orange,
      }}
    >
      <Icon name="sun" size={size * 0.55} color={colors.orangeText} strokeWidth={2} />
    </View>
  );
}
