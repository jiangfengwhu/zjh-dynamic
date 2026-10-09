import { View } from "react-native";
import { Pressy } from "../../../../../packages/ui/chrome";
import { useTheme } from "../../../../../packages/ui/theme";
import { HostText as Text } from "../feed/HostText";
import { UserAvatar } from "../UserAvatar";
import { openSharedPost } from "../navigation";
import type { SharedPost } from "./api";
export function SharedPostCard({ post }: { post: SharedPost }) {
  const { colors } = useTheme();
  return <Pressy onPress={() => openSharedPost(post.id)} accessibilityLabel={`查看 ${post.author.name} 的动态`} style={{ width: 260, maxWidth: "100%", padding: 12, borderRadius: 16, backgroundColor: colors.surface, borderWidth: colors.components.surfaceBorder, borderColor: colors.lineStrong, gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><UserAvatar uri={post.author.avatarUrl} authorId={post.author.id} size={28} /><Text numberOfLines={1} style={{ flex: 1, color: colors.ink1, fontWeight: "600" }}>{post.author.name}</Text></View>
    <Text numberOfLines={3} style={{ color: colors.ink2, fontSize: 14, lineHeight: 20 }}>{post.body}</Text>
    <Text style={{ color: colors.ink3, fontSize: 11 }}>社区动态</Text>
  </Pressy>;
}
