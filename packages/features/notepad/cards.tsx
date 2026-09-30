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
            accessibilityLabel="打开记事本"
            onPress={card.onOpen}
            scale={0.97}
            style={[styles.primary, { backgroundColor: colors.orchid }]}
          >
            <Icon name="edit" size={13} color={colors.onAccent} strokeWidth={2.2} />
            <Text style={[styles.primaryText, { color: colors.onAccent }]}>写点什么</Text>
          </Pressy>
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
}));

