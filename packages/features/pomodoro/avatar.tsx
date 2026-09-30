import { View } from "react-native";
import { Icon } from "@zijinhua/app-sdk/ui";
import { useTheme } from "@zijinhua/app-sdk/ui";
import type { AppAvatarProps } from "@zijinhua/app-sdk";

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
