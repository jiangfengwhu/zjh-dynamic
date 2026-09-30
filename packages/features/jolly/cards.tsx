import { Text, View } from "react-native";
import { Icon, Pressy } from "@zijinhua/app-sdk/ui";
import {
  PostAttachment,
  PostBody,
  PostFrame,
  type FeedCardProps,
} from "@zijinhua/app-sdk/ui";
import { themedStyleSheet, useTheme } from "@zijinhua/app-sdk/ui";
import { Pulse, WorkProgress, readWork } from "./parts";

const HOW = [
  { icon: "edit", label: "说一句心愿" },
  { icon: "workshop", label: "我来动手做" },
  { icon: "box", label: "打开就能用" },
] as const;

/**
 * 三条动态都是 Jolly 发的推文：头像、名字、时间和操作栏由 PostFrame 排好，
 * 这里只决定正文和附件里放什么。迎宾附上「怎么和我玩」，达成附上走完的三站，现场附上正在做的进度。
 */

/** 迎宾：正文是自我介绍，附件把「怎么和我玩」交代成三步，下面直接是许愿。 */
export function IntroCard(card: FeedCardProps) {
  const { colors } = useTheme();
  return (
    <PostFrame {...card} content={
      <View style={styles.content}>
        <PostBody post={card.post} />
        <PostAttachment>
          <View style={styles.path}>
            <View style={[styles.pathLine, { backgroundColor: colors.accentSoft }]} />
            {HOW.map((item, index) => (
              <View key={item.label} style={styles.pathItem}>
                {/* accentTint 是半透明的，直接做底会露出后面的连线；先垫一层不透明的底色，再盖淡色。 */}
                <View style={[styles.coin, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
                  <View style={[styles.coinTint, { backgroundColor: colors.accentTint }]} />
                  <Icon name={item.icon} size={11} color={colors.accentText} strokeWidth={2} />
                </View>
                <Text style={[styles.pathText, { color: colors.ink2 }]} numberOfLines={1}>
                  {index + 1} {item.label}
                </Text>
              </View>
            ))}
          </View>
          <Pressy
            accessibilityRole="button"
            accessibilityLabel="对Jolly许个心愿"
            onPress={card.onReply}
            scale={0.97}
            style={[styles.primary, { backgroundColor: colors.accent }]}
          >
            <Icon name="edit" size={13} color={colors.onAccent} strokeWidth={2.2} />
            <Text style={[styles.primaryText, { color: colors.onAccent }]}>许个心愿</Text>
          </Pressy>
        </PostAttachment>
      </View>
    } />
  );
}

/** 心愿达成：正文是这次做了什么，附件是一张「做好了」的回执，大字写心愿，下面是走完的三站。 */
export function DoneCard(card: FeedCardProps) {
  const { colors } = useTheme();
  const work = readWork(card.post.payload, "ready");
  const wish = work.wish || card.post.body;
  const note = work.wish && card.post.body !== work.wish ? card.post.body : "";
  return (
    <PostFrame {...card} content={
      <View style={styles.content}>
        {note ? <PostBody post={card.post} /> : null}
        <PostAttachment>
          <View style={styles.receiptTop}>
            <View style={[styles.seal, { backgroundColor: colors.accent }]}>
              <Icon name="check" size={9} color={colors.onAccent} strokeWidth={2.8} />
            </View>
            <Text style={[styles.eyebrow, { color: colors.accentText }]}>心愿达成</Text>
          </View>
          <Text style={styles.wish} numberOfLines={3}>
            {wish}
          </Text>
          <View style={styles.progress}>
            <WorkProgress work={{ ...work, phase: "ready" }} />
          </View>
        </PostAttachment>
      </View>
    } />
  );
}

/** 正在做的现场：一颗呼吸的点，大字写在做什么，做到哪一站，最近几步做了什么。 */
export function WorkingCard(card: FeedCardProps) {
  const { colors } = useTheme();
  const work = readWork(card.post.payload, "making");
  const wish = work.wish || card.post.body;
  // 状态已经出现在下面的进度记录里时，正文不再重复一遍
  const status = work.status && work.status !== wish && !work.steps.includes(work.status) ? work.status : "";
  const making = work.phase === "making";
  return (
    <PostFrame {...card} content={
      <View style={styles.content}>
        {status ? <Text style={styles.status}>{status}</Text> : null}
        <PostAttachment>
          <View style={styles.receiptTop}>
            <Pulse color={colors.accent} size={6} live={making} />
            <Text style={[styles.eyebrow, { color: colors.accentText }]}>{making ? "正在动手" : card.kindLabel}</Text>
          </View>
          <Text style={styles.wish} numberOfLines={2}>
            {wish}
          </Text>
          <View style={styles.progress}>
            <WorkProgress work={work} />
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
  path: {
    flexDirection: "row",
  },
  pathLine: {
    position: "absolute",
    top: 11,
    left: "16%",
    right: "16%",
    height: 1,
    borderRadius: 0.5,
  },
  pathItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    gap: 4,
  },
  coin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  coinTint: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 11,
  },
  pathText: {
    fontSize: 10.5,
    lineHeight: 14,
    fontWeight: "500",
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
  receiptTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  seal: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  wish: {
    marginTop: 4,
    fontFamily: t.serif,
    fontSize: 13.5,
    lineHeight: 19,
    fontWeight: "600",
    color: t.ink1,
  },
  status: {
    fontSize: 12,
    lineHeight: 17,
    color: t.ink2,
  },
  progress: {
    marginTop: 6,
  },
}));

