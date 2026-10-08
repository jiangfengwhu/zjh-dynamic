import { UserAvatar } from "./UserAvatar";
import { View } from "react-native";
import { Pressy } from "../../../../packages/ui/chrome";
import { HostText as Text } from "./feed/HostText";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { useTheme } from "../../../../packages/ui/theme";
/** An overlay never shifts the list or replaces data under the reader. */
export function NewDataNotice({ onPress, label = "查看新内容", avatars = [], top = 8 }: { onPress: () => void; label?: string; avatars?: string[]; top?: number }) {
  const { colors } = useTheme();
  return <View pointerEvents="box-none" style={{ position: "absolute", top, left: 0, right: 0, alignItems: "center", zIndex: 20 }}>
    <Pressy accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 24, backgroundColor: colors.accent, borderWidth: 0.5, borderColor: colors.accentSoft }}>
      <View style={{ transform: [{ rotate: "-90deg" }] }}><SymbolIcon name="arrow" size={18} color={colors.onAccent} /></View>
      {avatars.length ? <View style={{ flexDirection: "row", paddingRight: 4 }}>{avatars.slice(0, 3).map((uri, index) => <UserAvatar key={uri} uri={uri} size={28} style={{ marginLeft: index ? -8 : 0, borderWidth: 1, borderColor: colors.accent }} />)}</View> : null}
      <Text style={{ color: colors.onAccent, fontSize: 14 }}>{label}</Text>
    </Pressy>
  </View>;
}
