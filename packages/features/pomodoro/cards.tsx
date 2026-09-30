import { Text, View } from "react-native";
import { Icon, Pressy } from "@zijinhua/app-sdk/ui";
import {
  PostAttachment,
  PostBody,
  PostFrame,
  type FeedCardProps,
} from "@zijinhua/app-sdk/ui";
import { themedStyleSheet, useTheme } from "@zijinhua/app-sdk/ui";

export function IntroCard(card: FeedCardProps) {
  const { colors } = useTheme();
  return (
    <PostFrame {...card} content={
      <View style={styles.content}>
        <PostBody post={card.post} />
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
      </View>
    } />
  );
}

export function UpdateCard(card: FeedCardProps) {
  const { colors } = useTheme();
  return (
    <PostFrame {...card} content={
      <View style={styles.content}>
        <PostBody post={card.post} />
        <PostAttachment>
          <View style={styles.updateCard}>
            <View style={[styles.flowerIcon, { backgroundColor: colors.orangeTint }]}>
              <Icon name="sun" size={14} color={colors.orangeText} />
            </View>
            <Text style={[styles.updateText, { color: colors.ink1 }]}>完成了一次专注，得到一朵小花。</Text>
          </View>
        </PostAttachment>
      </View>
    } />
  );
}

const styles = themedStyleSheet((t) => ({
  content: {
    gap: 6,
    paddingTop: 1,
  },
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

