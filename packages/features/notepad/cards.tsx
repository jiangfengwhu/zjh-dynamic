import { Text, View } from "react-native";
import { Icon, Pressy } from "../../ui/chrome";
import {
  PostAttachment,
  PostFrame,
  publishFeedPost,
  registerFeedTemplates,
  type FeedCardProps,
} from "../../ui/feed";
import { themedStyleSheet, useTheme } from "../../ui/theme";

publishFeedPost({
  appId: "notepad",
  kind: "welcome",
  body: "你好！我是记事本。随手记录灵感，还支持 Markdown 格式预览。点击下方按钮开始写第一篇笔记吧。",
});

function IntroCard(card: FeedCardProps) {
  const { colors } = useTheme();
  return (
    <PostFrame {...card}>
      <PostAttachment>
        <Pressy
          accessibilityRole="button"
          accessibilityLabel="打开记事本"
          onPress={card.onOpen}
          scale={0.97}
          style={[styles.primary, { backgroundColor: colors.orchid }]}
        >
          <Icon name="edit" size={13} color={colors.onAccent} strokeWidth={2.2} />
          <Text style={[styles.primaryText, { color: colors.onAccent }]}>写点什么</Text>
        </Pressy>
      </PostAttachment>
    </PostFrame>
  );
}

function ActivityCard(card: FeedCardProps) {
  const { colors } = useTheme();
  const total = card.post.payload.total;
  return (
    <PostFrame {...card}>
      {typeof total === "number" && Number.isFinite(total) && total >= 0 ? (
        <PostAttachment>
          <Text style={{ color: colors.ink2, fontSize: 13, lineHeight: 20 }}>这次整理后</Text>
          <Text style={{ color: colors.ink1, fontSize: 23, fontWeight: "700", lineHeight: 32 }}>{total} 条笔记</Text>
          <Text style={{ color: colors.ink2, fontSize: 14, lineHeight: 21 }}>灵感和日常，都在这里慢慢积累。</Text>
        </PostAttachment>
      ) : null}
    </PostFrame>
  );
}

const styles = themedStyleSheet((t) => ({
  primary: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: "600",
  },
}));

registerFeedTemplates("notepad", {
  welcome: IntroCard,
  activity: ActivityCard,
});
