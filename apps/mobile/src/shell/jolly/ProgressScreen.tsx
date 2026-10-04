import { useEffect, useRef, useState } from "react";
import { cachedAccountId, subscribeAccountIdentity } from "../account";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import {
  Screen,
  ScreenBar,
  ThemeContext,
  useTheme,
} from "../../../../../packages/app-sdk/src/host-ui";
import { JollyVideoPlayer } from "./ui/video";
import { JollyPortrait } from "./ui/portrait";
import { PixelIcon } from "../../../../../packages/ui/chrome/PixelIcon";
import { PixelText as Text } from "../feed/PixelText";
import { usePixelTheme as useProgressTheme } from "../../../../../packages/ui/pixelTheme";
import {
  progressLabels,
  progressState,
  useProgress,
  type ProgressState,
} from "./progress";

type Props = {
  appId?: string;
  title?: string;
  originalAppId?: string;
  scope: string;
  onBack: () => void;
};
export default function ProgressScreen(props: Props) {
  const theme = useProgressTheme();
  const [allowed, setAllowed] = useState(
    () => cachedAccountId() === props.scope
  );
  useEffect(
    () =>
      subscribeAccountIdentity((owner) => {
        const valid = owner === props.scope;
        setAllowed(valid);
        if (!valid) props.onBack();
      }),
    [props.scope, props.onBack]
  );
  return (
    <ThemeContext.Provider value={theme}>
      {allowed ? (
        <ProgressContent {...props} />
      ) : (
        <Screen style={{ backgroundColor: theme.colors.canvas }} />
      )}
    </ThemeContext.Provider>
  );
}
const descriptions: Record<ProgressState, string> = {
  queued: "需求已收到，轮到你时就会开始。",
  making: "Jolly 正在实现你的想法。",
  packing: "制作已结束，正在等待作品交付。",
  ready: "作品已就绪，到「我的 → 作品」打开与管理。",
  reply: "需要补充你的想法，请到「我的 → 作品」继续修改。",
  paused: "任务已暂停，请到「我的 → 作品」继续处理。",
  failed: "本次制作未完成，请到「我的 → 作品」继续处理。",
  blocked: "交付尚未完成，请到「我的 → 作品」查看并处理。",
};
function ProgressContent({
  appId,
  title,
  originalAppId,
  scope,
  onBack,
}: Props) {
  const { colors } = useTheme();
  const query = useProgress(appId, originalAppId, scope);
  const [expanded, setExpanded] = useState(false);
  const state = query.snapshot
    ? progressState(query.snapshot.detail)
    : undefined;
  const danger = state === "failed" || state === "blocked";
  const ready = state === "ready";
  const waiting = state === "reply" || state === "paused";
  const tint = ready
    ? colors.greenTint
    : danger
    ? colors.redTint
    : waiting
    ? colors.orchidTint
    : colors.accentTint;
  const tone = ready
    ? colors.greenText
    : danger
    ? colors.redText
    : waiting
    ? colors.orchidText
    : colors.accentText;
  const accent = ready
    ? colors.green
    : danger
    ? colors.red
    : waiting
    ? colors.orchid
    : colors.accent;
  const latest = query.snapshot?.detail.traces
    .filter(
      (trace) => trace.kind === "text" && (trace.detail || trace.title).trim()
    )
    .at(-1);
  const message = (
    danger || waiting
      ? query.snapshot?.detail.status.message ||
        latest?.detail ||
        latest?.title ||
        ""
      : latest?.detail || latest?.title || ""
  )
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[`#*]/g, "")
    .trim()
    .slice(0, 1600);
  const step = ready ? 2 : state === "packing" || state === "blocked" ? 1 : 0;
  const workTitle =
    query.snapshot?.detail.status.application?.title || title || "这次制作";
  const empty = !appId || (query.loaded && !query.snapshot && !query.error);
  return (
    <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
      <ScreenBar
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          paddingVertical: 2,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回紫金花"
          onPress={onBack}
          style={{
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PixelIcon name="back" color={colors.ink1} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, textAlign: "center", fontSize: 18 }}
        >
          制作进度
        </Text>
        <RefreshButton
          disabled={!appId}
          busy={query.checking}
          onPress={() => {
            void query.refresh();
          }}
          active={query.active}
        />
      </ScreenBar>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 24,
          gap: 14,
        }}
      >
        {empty ? (
          <View style={{ alignItems: "center", paddingVertical: 48, gap: 16 }}>
            <JollyPortrait size={88} animated={false} />
            <Text style={{ fontSize: 20 }}>暂无制作任务</Text>
            <Text
              style={{
                color: colors.ink3,
                fontSize: 13,
                lineHeight: 21,
                textAlign: "center",
                maxWidth: 280,
              }}
            >
              从「我的 → 作品」选择任务，即可在这里查看进度。
            </Text>
          </View>
        ) : (
          <>
            <Text
              numberOfLines={1}
              style={{ color: colors.ink2, fontSize: 14, lineHeight: 20 }}
            >
              {workTitle}
            </Text>
            {state ? (
              <View
                style={{
                  overflow: "hidden",
                  borderRadius: 12,
                  borderWidth: 0.5,
                  borderColor: colors.lineStrong,
                  backgroundColor: tint,
                }}
              >
                <View style={{ height: 4, backgroundColor: accent }} />
                <View
                  style={{
                    flexDirection: "row",
                    gap: 12,
                    padding: 14,
                    alignItems: "center",
                  }}
                >
                  <JollyVideoPlayer
                    state={
                      ready
                        ? "level_up"
                        : state === "making"
                        ? "making"
                        : state === "packing"
                        ? "working"
                        : "idle"
                    }
                    width={80}
                    height={80}
                    borderRadius={40}
                    still={
                      !query.active || waiting || danger || state === "queued"
                    }
                    repeat={!ready}
                  />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <PixelIcon
                        name={
                          ready
                            ? "check"
                            : danger
                            ? "alert"
                            : waiting || state === "queued"
                            ? "clock"
                            : "spark"
                        }
                        size={16}
                        color={tone}
                      />
                      <Text style={{ color: tone, fontSize: 11 }}>
                        {ready
                          ? "已完成"
                          : danger
                          ? "需要处理"
                          : waiting
                          ? "等待操作"
                          : state === "queued"
                          ? "已收到需求"
                          : "任务进行中"}
                      </Text>
                    </View>
                    <Text
                      accessibilityLiveRegion="polite"
                      style={{ fontSize: 22, lineHeight: 29 }}
                    >
                      {progressLabels[state]}
                    </Text>
                  </View>
                </View>
                <Text
                  style={{
                    paddingHorizontal: 14,
                    paddingBottom: 14,
                    color: colors.ink2,
                    fontSize: 13,
                    lineHeight: 21,
                  }}
                >
                  {descriptions[state]}
                </Text>
              </View>
            ) : (
              <LoadingPanel failed={!!query.error} />
            )}
            {state ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                {["制作", "交付", "完成"].map((label, index) => {
                  const done = ready || index < step;
                  const current = index === step && !ready;
                  const foreground = done
                    ? colors.greenText
                    : current
                    ? tone
                    : colors.ink3;
                  return (
                    <View
                      key={label}
                      accessibilityLabel={`${label}，${
                        done
                          ? "已完成"
                          : current
                          ? progressLabels[state]
                          : "未开始"
                      }`}
                      style={{
                        flex: 1,
                        minHeight: 78,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        borderRadius: 8,
                        backgroundColor: done
                          ? colors.greenTint
                          : current
                          ? tint
                          : colors.canvas,
                        borderWidth: 0.5,
                        borderColor: current ? foreground : colors.line,
                      }}
                    >
                      <PixelIcon
                        name={
                          done
                            ? "check"
                            : index === 0
                            ? "spark"
                            : index === 1
                            ? "box"
                            : "check"
                        }
                        size={18}
                        color={foreground}
                      />
                      <Text style={{ color: foreground, fontSize: 12 }}>
                        {label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {query.error ? (
              <View
                style={{
                  gap: 6,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: colors.cyanTint,
                }}
              >
                <View
                  style={{ flexDirection: "row", gap: 7, alignItems: "center" }}
                >
                  <PixelIcon name="info" size={14} color={colors.cyanText} />
                  <Text style={{ color: colors.cyanText, fontSize: 12 }}>
                    进度暂未同步
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 12, color: colors.ink2, lineHeight: 19 }}
                >
                  {query.error}
                </Text>
                {query.error ? (
                  <Pressable
                    disabled={query.checking}
                    accessibilityRole="button"
                    onPress={() => {
                      void query.refresh();
                    }}
                    style={{
                      minHeight: 44,
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 13, color: colors.cyanText }}>
                      {query.checking ? "正在重试…" : "重新同步"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {state && message ? (
              <View style={{ gap: 8, paddingTop: 2 }}>
                <Text style={{ fontSize: 13, color: colors.ink3 }}>
                  最新进展
                </Text>
                <Text
                  numberOfLines={expanded ? undefined : 3}
                  style={{ fontSize: 13, lineHeight: 22, color: colors.ink2 }}
                >
                  {message}
                </Text>
                {message.length > 90 ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                    onPress={() => setExpanded((value) => !value)}
                    style={{
                      minHeight: 44,
                      alignSelf: "flex-start",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: colors.orchidText, fontSize: 12 }}>
                      {expanded ? "收起" : "展开进展"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {state && ["queued", "making", "packing"].includes(state) ? (
              <Text
                style={{ fontSize: 11, lineHeight: 18, color: colors.ink3 }}
              >
                无需守在这里，完成或失败都会收到站内通知。
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
function RefreshButton({
  disabled,
  busy,
  active,
  onPress,
}: {
  disabled: boolean;
  busy: boolean;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!busy || !active) {
      spin.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [busy, active, spin]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={busy ? "正在同步进度" : "刷新制作进度"}
      accessibilityState={{ busy, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Animated.View
        style={{
          transform: [
            {
              rotate: spin.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "360deg"],
              }),
            },
          ],
        }}
      >
        <PixelIcon name="refresh" size={18} color={colors.cyanText} />
      </Animated.View>
    </Pressable>
  );
}
function LoadingPanel({ failed }: { failed: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        minHeight: 166,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      {failed ? (
        <PixelIcon name="alert" size={24} color={colors.redText} />
      ) : (
        <ActivityIndicator color={colors.cyanText} />
      )}
      <Text style={{ fontSize: 14, color: colors.ink2 }}>
        {failed ? "加载失败，请重试" : "加载中…"}
      </Text>
    </View>
  );
}
