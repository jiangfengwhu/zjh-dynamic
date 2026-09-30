import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";
import LinearGradient from "react-native-linear-gradient";
import { BackChip, Icon, Pressy, SectionTitle, Surface, clear } from "../../ui/chrome";
import { readFeedChanges, readFeedPosts, subscribeFeedPosts, type FeedChange, type FeedPost } from "../../ui/feed";
import { JollyVideoPlayer, readJollyRun, subscribeJollyRun, type JollyRun, type JollyVideoState } from "../../ui/jolly";
import { themedStyleSheet, useTheme } from "../../ui/theme";
import { registerFeature } from "../src/featureHost";
import { Pulse, WorkProgress, ago, askShell } from "./parts";

const RECENT_LIMIT = 8;

/** Jolly 此刻的样子：视频、状态胶囊和一句话都由它决定。 */
function moodOf(run: JollyRun): { video: JollyVideoState; label: string; line: string; live: boolean } {
  const wish = run.wish ? `「${run.wish}」` : "这个心愿";
  if (run.phase === "making") return { video: "making", label: "正在开工", line: `${wish}我在做了，你可以先去别处逛逛。`, live: true };
  if (run.phase === "ready") return { video: "level_up", label: "刚做好", line: `${wish}做好了，去动态里认识新朋友吧。`, live: false };
  if (run.phase === "failed") return { video: "idle", label: "遇到点麻烦", line: `${wish}没做成：${run.status || "出了点错"}。改一改再来一次？`, live: false };
  if (run.phase === "stopped") return { video: "idle", label: "先停下了", line: `${wish}先停在这里，想继续随时告诉我。`, live: false };
  return { video: "idle", label: "待命中", line: "今天想做点什么？说一句就行，剩下的交给我。", live: false };
}

function recentChanges(): FeedChange[] {
  return readFeedChanges(0).filter((item) => item.appId === "jolly").slice(0, RECENT_LIMIT);
}

function JollyApp() {
  const { colors } = useTheme();
  const [run, setRun] = useState<JollyRun>(() => readJollyRun());
  const [posts, setPosts] = useState<FeedPost[]>(() => readFeedPosts());
  const [changes, setChanges] = useState<FeedChange[]>(() => recentChanges());
  useEffect(() => subscribeJollyRun((next) => {
    setRun(next);
    setChanges(recentChanges());
  }), []);
  useEffect(() => subscribeFeedPosts((next) => {
    setPosts(next);
    setChanges(recentChanges());
  }), []);

  const mood = moodOf(run);
  const stats = useMemo(() => {
    const friends = new Set(posts.map((post) => post.appId));
    friends.delete("jolly");
    return {
      friends: friends.size,
      posts: posts.length,
      wishes: posts.filter((post) => post.appId === "jolly" && post.kind === "update").length,
    };
  }, [posts]);
  const working = run.phase !== "idle";
  const wash = colors.accentTint;

  return (
    <View style={[page.screen, { backgroundColor: colors.canvas }]}>
      {/* 壳已经给这一页留好了系统栏的位置，顶栏只管自己这一行 */}
      <View style={page.bar}>
        <BackChip onPress={() => askShell({ action: "back" })} />
        <View style={page.barCopy}>
          <Text style={[page.barTitle, { color: colors.ink1 }]}>Jolly</Text>
          <Text style={[page.barCaption, { color: colors.ink3 }]}>心愿工坊的小管家</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={page.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(480).easing(Easing.out(Easing.cubic))}>
          <Surface tone="base" radius={colors.radius.xxl} style={page.hero}>
            <LinearGradient
              pointerEvents="none"
              colors={[wash, clear(wash)]}
              start={{ x: 0.2, y: 0 }}
              end={{ x: 0.8, y: 1 }}
              style={page.heroWash}
            />
            <View style={page.heroTop}>
              <View style={[page.portrait, { borderColor: colors.accentSoft }]}>
                <JollyVideoPlayer state={mood.video} width={104} height={104} borderRadius={30} resizeMode="cover" repeat />
              </View>
              <View style={page.heroCopy}>
                <Text style={[page.name, { color: colors.ink1 }]}>Jolly</Text>
                <View style={[page.pill, { backgroundColor: colors.accentTint, borderColor: colors.accentSoft }]}>
                  <Pulse color={colors.accent} size={7} live={mood.live} />
                  <Text style={[page.pillText, { color: colors.accentText }]}>{mood.label}</Text>
                </View>
                <Text style={[page.role, { color: colors.ink3 }]}>把一句心愿做成能打开的小应用</Text>
              </View>
            </View>
            <View style={[page.bubble, { backgroundColor: colors.inset, borderColor: colors.line }]}>
              <View style={[page.quote, { backgroundColor: colors.accent }]} />
              <Text style={[page.bubbleText, { color: colors.ink1 }]}>{mood.line}</Text>
            </View>
            <Pressy
              accessibilityRole="button"
              onPress={() => askShell({ action: "tab", tab: "agent" })}
              scale={0.97}
              style={[page.cta, { backgroundColor: colors.accent }]}
            >
              <Icon name="workshop" size={18} color={colors.onAccent} strokeWidth={2} />
              <Text style={[page.ctaText, { color: colors.onAccent }]}>{working && run.phase === "making" ? "去工坊看进度" : "去工坊许个愿"}</Text>
            </Pressy>
          </Surface>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(90).duration(480).easing(Easing.out(Easing.cubic))} style={page.stats}>
          <Stat value={stats.wishes} label="做成的心愿" />
          <Stat value={stats.friends} label="认识的朋友" />
          <Stat value={stats.posts} label="动态" />
        </Animated.View>

        {working ? (
          <Animated.View entering={FadeInDown.delay(160).duration(480).easing(Easing.out(Easing.cubic))} style={page.block}>
            <SectionTitle>{run.phase === "making" ? "手上的活" : "上一个心愿"}</SectionTitle>
            <Surface tone="raised" style={page.work}>
              <Text style={[page.wish, { color: colors.ink1, fontFamily: colors.serif }]} numberOfLines={3}>
                {run.wish || "一个心愿"}
              </Text>
              <WorkProgress work={{ phase: run.phase, wish: run.wish, status: run.status, steps: run.steps }} />
            </Surface>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(230).duration(480).easing(Easing.out(Easing.cubic))} style={page.block}>
          <SectionTitle>最近的事</SectionTitle>
          {changes.length === 0 ? (
            <Surface tone="inset" style={page.empty}>
              <Text style={[page.emptyText, { color: colors.ink3 }]}>还没有记录。许下第一个心愿，这里就会热闹起来。</Text>
            </Surface>
          ) : (
            <View style={page.timeline}>
              {changes.map((item, index) => (
                <View key={`${item.at}-${index}`} style={page.event}>
                  <View style={page.rail}>
                    <View style={[page.dot, { backgroundColor: index === 0 ? colors.accent : colors.lineStrong }]} />
                    {index === changes.length - 1 ? null : <View style={[page.thread, { backgroundColor: colors.line }]} />}
                  </View>
                  <View style={page.eventBody}>
                    <Text style={[page.eventNote, { color: colors.ink1 }]}>{item.note}</Text>
                    <Text style={[page.eventTime, { color: colors.ink3 }]}>{ago(item.at)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  const { colors } = useTheme();
  return (
    <Surface tone="raised" radius={colors.radius.lg} style={page.stat}>
      <Text style={[page.statValue, { color: colors.ink1, fontFamily: colors.serif }]}>{value}</Text>
      <Text style={[page.statLabel, { color: colors.ink3 }]}>{label}</Text>
    </Surface>
  );
}

const page = themedStyleSheet((t) => ({
  screen: {
    flex: 1,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  barCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  barTitle: {
    fontFamily: t.serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  barCaption: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 36,
    gap: 16,
  },
  hero: {
    padding: 18,
    gap: 16,
  },
  heroWash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  portrait: {
    width: 108,
    height: 108,
    borderRadius: 32,
    borderWidth: 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    alignItems: "flex-start",
  },
  name: {
    fontFamily: t.serif,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: 1,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pillText: {
    fontSize: 12.5,
    fontWeight: "700",
  },
  role: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  bubble: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quote: {
    width: 3,
    borderRadius: 2,
  },
  bubbleText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
  },
  cta: {
    height: 48,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  ctaText: {
    fontSize: 15.5,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  block: {
    gap: 8,
  },
  work: {
    padding: 16,
    gap: 16,
  },
  wish: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "700",
  },
  empty: {
    padding: 16,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
  },
  timeline: {
    paddingHorizontal: 6,
    paddingTop: 6,
  },
  event: {
    flexDirection: "row",
    gap: 14,
  },
  rail: {
    width: 12,
    alignItems: "center",
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginTop: 6,
  },
  thread: {
    flex: 1,
    width: StyleSheet.hairlineWidth * 2,
    marginTop: 4,
  },
  eventBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingBottom: 18,
  },
  eventNote: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  eventTime: {
    fontSize: 12,
    lineHeight: 16,
  },
}));

registerFeature("jolly", JollyApp);
