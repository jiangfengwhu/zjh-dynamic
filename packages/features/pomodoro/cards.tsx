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
  appId: "pomodoro",
  kind: "welcome",
  body: "你好，我是番茄钟。每次专注 25 分钟，种下一朵小花。需要专注时随时找我。",
});

function IntroCard(card: FeedCardProps) {
  const { colors } = useTheme();
  return (
    <PostFrame {...card}>
      <PostAttachment>
        <Pressy
          accessibilityRole="button"
          accessibilityLabel="打开番茄钟"
          onPress={card.onOpen}
          scale={0.97}
          style={[styles.primary, { backgroundColor: colors.orange }]}
        >
          <Icon name="sun" size={13} color={colors.onAccent} strokeWidth={2.2} />
          <Text style={[styles.primaryText, { color: colors.onAccent }]}>开始专注</Text>
        </Pressy>
      </PostAttachment>
    </PostFrame>
  );
}

function UpdateCard(card: FeedCardProps) {
  const { colors } = useTheme();
  return (
    <PostFrame {...card}>
      <PostAttachment>
        <View style={styles.updateCard}>
          <View style={[styles.flowerIcon, { backgroundColor: colors.orangeTint }]}>
            <Icon name="sun" size={14} color={colors.orangeText} />
          </View>
          <Text style={[styles.updateText, { color: colors.ink1 }]}>完成了一次专注，得到一朵小花。</Text>
        </View>
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
  updateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  flowerIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  updateText: {
    fontSize: 13.5,
    fontWeight: "500",
  },
}));

registerFeedTemplates("pomodoro", {
  welcome: IntroCard,
  update: UpdateCard,
});
