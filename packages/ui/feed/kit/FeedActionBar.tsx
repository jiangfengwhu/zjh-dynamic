import { ActivityIndicator, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Share2 } from "lucide-react-native";
import { Pressy } from "../../chrome";
import { useTheme } from "../../theme";
import { FeedText } from "./FeedPresentation";

export function FeedActionBar({
  liked,
  busy,
  comments,
  likes,
  onComment,
  onLike,
  onShare,
}: {
  liked: boolean;
  busy?: boolean;
  comments?: number;
  likes?: number;
  onComment?: () => void;
  onLike: () => void;
  onShare: () => void;
}) {
  const { colors } = useTheme();
  const action = {
    minHeight: 32,
    minWidth: 44,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 3,
  };
  const icon = (heart: boolean) => (
    <Svg width={18} height={18} viewBox="0 0 16 16" accessible={false}>
      <Path
        fill={heart && liked ? colors.redText : colors.ink3}
        fillRule="evenodd"
        d={
          heart
            ? "M2 3h4v2h4V3h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V5h2z"
            : "M1 2h14v10H7l-4 3v-3H1zM3 4v6h2v2l2-2h6V4z"
        }
      />
    </Svg>
  );
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 1,
      }}
    >
      <Pressy
        accessibilityRole="button"
        accessibilityLabel={`评论 ${comments ?? 0} 条`}
        onPress={onComment}
        hitSlop={{ top: 6, bottom: 6 }}
        style={action}
      >
        {icon(false)}
        {comments ? (
          <FeedText style={{ fontSize: 12, color: colors.ink3 }}>
            {comments}
          </FeedText>
        ) : null}
      </Pressy>
      <Pressy
        accessibilityRole="button"
        accessibilityLabel={liked ? "取消点赞" : "点赞"}
        accessibilityState={{ selected: liked, disabled: !!busy }}
        disabled={busy}
        onPress={onLike}
        hitSlop={{ top: 6, bottom: 6 }}
        style={action}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          icon(true)
        )}
        {likes ? (
          <FeedText
            style={{
              fontSize: 12,
              color: liked ? colors.redText : colors.ink3,
            }}
          >
            {likes}
          </FeedText>
        ) : null}
      </Pressy>
      <Pressy
        accessibilityRole="button"
        accessibilityLabel="分享动态"
        onPress={onShare}
        hitSlop={{ top: 6, bottom: 6 }}
        style={action}
      >
        <Share2 size={19} color={colors.ink3} />
      </Pressy>
    </View>
  );
}
