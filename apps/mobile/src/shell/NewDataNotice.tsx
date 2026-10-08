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
    <Pressy accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ minHeight: 36, paddingLeft: 10, paddingRight: 14, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 18, backgroundColor: colors.accent, boxShadow: "0 6px 18px rgba(123,77,255,0.35)" }}>
      <View style={{ transform: [{ rotate: "-90deg" }] }}><SymbolIcon name="arrow" size={15} strokeWidth={2.4} color={colors.onAccent} /></View>
      {avatars.length ? <View style={{ flexDirection: "row", paddingRight: 4 }}>{avatars.slice(0, 3).map((uri, index) => <UserAvatar key={uri} uri={uri} size={22} style={{ marginLeft: index ? -7 : 0, borderWidth: 1.5, borderColor: colors.accent }} />)}</View> : null}
      <Text style={{ color: colors.onAccent, fontSize: 13, fontWeight: "700", letterSpacing: -0.1 }}>{label}</Text>
    </Pressy>
  </View>;
}
