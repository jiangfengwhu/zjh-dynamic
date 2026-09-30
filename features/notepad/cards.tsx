import { Text, View } from "react-native";
import { Icon, Pressy } from "../../components/chrome";
import {
  PostAttachment,
  PostFrame,
  publishFeedPost,
  registerFeedTemplates,
  type FeedCardProps,
} from "../../components/feed";
import { themedStyleSheet, useTheme } from "../../components/theme";
import { writePackageValue } from "../../components/packageLink";

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

const styles = themedStyleSheet((t) => ({
  primary: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
  },
  primaryText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
}));

registerFeedTemplates("notepad", {
  welcome: IntroCard,
});
