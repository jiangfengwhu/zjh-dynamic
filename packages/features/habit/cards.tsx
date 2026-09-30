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
  appId: "habit",
  kind: "welcome",
  body: "你好！我是你的习惯小助手。无论是早睡、喝水还是每天打卡，我都会在这里为你加油，记录你的每一个小进步。",
});

function IntroCard(card: FeedCardProps) {
  const { colors } = useTheme();
  return (
    <PostFrame {...card}>
      <PostAttachment>
        <View style={styles.introTop}>
          <View style={[styles.iconWrap, { backgroundColor: colors.orangeTint }]}>
            <Icon name="sun" size={16} color={colors.orangeText} />
          </View>
          <Text style={[styles.introText, { color: colors.ink1 }]}>
            陪你养成好习惯
          </Text>
        </View>
        <Pressy
          accessibilityRole="button"
          onPress={card.onReply}
          scale={0.97}
          style={[styles.primaryBtn, { backgroundColor: colors.orange }]}
        >
          <Icon name="check" size={13} color={colors.onAccent} strokeWidth={2.2} />
          <Text style={[styles.primaryBtnText, { color: colors.onAccent }]}>去打卡</Text>
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
        <View style={styles.updateWrap}>
          <View style={[styles.seal, { backgroundColor: colors.orange }]}>
            <Icon name="check" size={10} color={colors.onAccent} strokeWidth={2.8} />
          </View>
          <Text style={[styles.updateEyebrow, { color: colors.orangeText }]}>
            小目标达成
          </Text>
        </View>
      </PostAttachment>
    </PostFrame>
  );
}

const styles = themedStyleSheet((t) => ({
  introTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  introText: {
    fontSize: 14,
    fontWeight: "600",
  },
  primaryBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  primaryBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  updateWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  seal: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  updateEyebrow: {
    fontSize: 12,
    fontWeight: "600",
  },
}));

registerFeedTemplates("habit", {
  welcome: IntroCard,
  update: UpdateCard,
});
