import { memo, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutUp,
  LinearTransition,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { EdgeModal as Modal, Screen, ScreenBar } from "@zijinhua/app-sdk/ui";
import { PromptBar } from "@zijinhua/app-sdk/ui";
import { GiltLine, Icon, Pressy, SectionTitle, Surface } from "@zijinhua/app-sdk/ui";
import { JollyLoading, JollyVideoPlayer, type JollyState } from "./ui";
import { themedStyleSheet, useTheme, type Theme } from "@zijinhua/app-sdk/ui";
import { AGENT_PROVIDERS } from "./agentProviders";
import { getCreationService } from "@zijinhua/app-sdk/creation";
const { readPreference: readShellValue, writePreference: writeShellValue } = getCreationService();

export type AgentTrace = {
  id: string;
  kind: "text" | "tool" | "status";
  title: string;
  detail?: string;
  state: "running" | "done" | "error";
};

type Props = {
  value: string;
  prompt: string;
  status: string;
  busy: boolean;
  traces: AgentTrace[];
  report: string;
  startedAt?: number;
  sessionId: string;
  sessionLoading: boolean;
  onNewSession: () => void;
  awaitingConfirmation: boolean;
  workshopReady: boolean;
  awaitingReply: boolean;
  confirmationBusy: boolean;
  confirmationMessage: string;
  onConfirmWish: () => void;
  onLoadWish: () => void;
  providerId: string;
  onProviderChange: (id: string) => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onBack?: () => void;
};

type Idea = {
  category: string;
  title: string;
  prompt: string;
};

const IDEAS: Idea[] = [
  {
    category: "专注",
    title: "森林番茄钟",
    prompt: "温暖治愈的番茄钟：带 25 分钟倒计时环、今日专注小花朵计数、休息提醒与柔和音效",
  },
  {
    category: "手账",
    title: "每日心晴手账",
    prompt: "随身心晴手账：按日期记录今日心动瞬间、待办小愿望与随笔想法，支持一键清空与本地保存",
  },
  {
    category: "打卡",
    title: "七日小习惯",
    prompt: "温馨可爱的习惯打卡：7 日打卡连胜点亮、喝水/早睡小目标计数与鼓励贴纸面板",
  },
];

type Tone = "cyan" | "orchid" | "amber" | "emerald";

function cleanTraceDetail(raw?: string): string {
  if (!raw) return "";
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/^[\s\n\r]+/, "")
    .replace(/[\s\n\r]+$/, "")
    .replace(/\n{3,}/g, "\n\n");
}

function classifyToolChip(title: string): { chip: string; tone: Tone } {
  const lower = title.toLowerCase();
  if (
    lower.includes("read") ||
    lower.includes("view") ||
    lower.includes("grep") ||
    lower.includes("search") ||
    lower.includes("find") ||
    lower.includes("list") ||
    title.includes("读取") ||
    title.includes("查看") ||
    title.includes("搜索")
  ) {
    return { chip: "查阅", tone: "cyan" };
  }
  if (
    lower.includes("write") ||
    lower.includes("edit") ||
    lower.includes("replace") ||
    lower.includes("patch") ||
    lower.includes("create") ||
    title.includes("写入") ||
    title.includes("修改") ||
    title.includes("生成")
  ) {
    return { chip: "编制", tone: "orchid" };
  }
  if (
    lower.includes("bash") ||
    lower.includes("exec") ||
    lower.includes("run") ||
    lower.includes("cmd") ||
    lower.includes("tsc") ||
    lower.includes("build") ||
    title.includes("执行") ||
    title.includes("编译")
  ) {
    return { chip: "运行", tone: "amber" };
  }
  return { chip: "步骤", tone: "emerald" };
}

function toneColors(tone: Tone, colors: Theme): { text: string; tint: string } {
  if (tone === "cyan") return { text: colors.cyanText, tint: colors.cyanTint };
  if (tone === "orchid") return { text: colors.orchidText, tint: colors.orchidTint };
  if (tone === "amber") return { text: colors.amberText, tint: colors.amberTint };
  return { text: colors.greenText, tint: colors.greenTint };
}

export const AgentScreen = memo(function AgentScreen({
  value,
  prompt,
  status,
  busy,
  traces,
  report,
  startedAt = 0,
  sessionId,
  sessionLoading,
  onNewSession,
  awaitingConfirmation,
  workshopReady,
  awaitingReply,
  confirmationBusy,
  confirmationMessage,
  onConfirmWish,
  onLoadWish,
  providerId,
  onProviderChange,
  onChange,
  onSubmit,
  onStop,
  onBack,
}: Props) {
  const { colors } = useTheme();

  const [companionName, setCompanionName] = useState("狗蛋");
  const [nameInput, setNameInput] = useState("狗蛋");
  const [nameModalVisible, setNameModalVisible] = useState(false);

  const [traceExpanded, setTraceExpanded] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [elapsedTenths, setElapsedTenths] = useState(0);
  const [showLastSnapshot, setShowLastSnapshot] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await readShellValue("shell.companion.name.v1");
        if (saved) {
          setCompanionName(saved);
          setNameInput(saved);
        }
      } catch (err) {
        // use default "狗蛋"
      }
    })();
  }, []);

  const handleSaveName = async () => {
    const trimmed = nameInput.trim() || "狗蛋";
    setCompanionName(trimmed);
    setNameModalVisible(false);
    try {
      writeShellValue("shell.companion.name.v1", trimmed);
    } catch (err) {
      console.log("save companion name failed", err);
    }
  };

  const openNameEditor = () => {
    setNameInput(companionName);
    setNameModalVisible(true);
  };

  useEffect(() => {
    if (!busy) return;
    setTraceExpanded(false);
    const origin = startedAt > 0 ? startedAt : Date.now();
    const tick = () => setElapsedTenths(Math.max(0, Math.round((Date.now() - origin) / 100)));
    tick();
    const clockTimer = setInterval(tick, 100);
    return () => {
      clearInterval(clockTimer);
    };
  }, [busy, prompt, startedAt]);

  const actionTraces = useMemo(() => traces.filter((t) => t.kind !== "text"), [traces]);
  const stillRunning = busy;
  const latestText = useMemo(
    () => cleanTraceDetail([...traces].reverse().find((t) => t.kind === "text")?.detail),
    [traces]
  );
  const finalReport = cleanTraceDetail(report) || (!stillRunning ? latestText : "");

  const hasError = useMemo(
    () =>
      traces.some((t) => t.state === "error") ||
      status.includes("失败") ||
      status.toLowerCase().includes("error"),
    [traces, status]
  );

  const hasSession = busy || Boolean(prompt) || traces.length > 0;

  const currentTicker = useMemo(() => {
    const latestAction = actionTraces[actionTraces.length - 1];
    if (stillRunning) {
      if (status && (status.includes("下载") || status.includes("同步") || status.includes("停止"))) {
        return { key: `status-${status}`, badge: "同步", text: status.trim() };
      }
      if (latestAction) {
        const chip =
          latestAction.kind === "tool"
            ? classifyToolChip(latestAction.title).chip
            : latestAction.title.includes("思考")
              ? "思考"
              : "阶段";
        return { key: latestAction.id, badge: chip, text: latestAction.title.trim() };
      }
      return { key: `boot-${status || "init"}`, badge: "准备", text: (status || "正在构思你的想法").trim() };
    }

    if (hasError) {
      const errNode = [...traces].reverse().find((t) => t.state === "error");
      return {
        key: `err-${errNode?.id ?? status}`,
        badge: "提示",
        text: (errNode?.title || status || "遇到一点小波折").trim(),
      };
    }

    return {
      key: `done-${actionTraces.length}-${status}`,
      badge: "完成",
      text: actionTraces.length > 0 ? "做好了，可以去体验" : (status || "做好了，可以去体验").trim(),
    };
  }, [stillRunning, status, actionTraces, hasError, traces]);

  const elapsedText = useMemo(() => {
    const totalSec = elapsedTenths / 10;
    if (totalSec === 0 && !busy) return "";
    return totalSec < 60
      ? `${totalSec.toFixed(1)}s`
      : `${Math.floor(totalSec / 60)}m ${(totalSec % 60).toFixed(0)}s`;
  }, [elapsedTenths, busy]);

  const runningTrace = useMemo(() => traces.find((t) => t.state === "running"), [traces]);

  const jollyLiveState: JollyState = useMemo(() => {
    if (!hasSession && !busy) return "idle";
    if (stillRunning) {
      if (traces.length === 0 || runningTrace?.id === "boot") {
        return "waking";
      }
      if (
        runningTrace?.id === "thinking" ||
        status.includes("下载") ||
        status.includes("打包") ||
        status.includes("构想")
      ) {
        return "making";
      }
      return "working";
    }
    if (hasError) return "waking";
    if (hasSession && finalReport) return "level_up";
    return "idle";
  }, [hasSession, stillRunning, traces.length, runningTrace, status, hasError, finalReport]);

  const phase: "busy" | "error" | "done" | "idle" = stillRunning ? "busy" : hasError ? "error" : hasSession ? "done" : "idle";
  const phaseLabel = awaitingConfirmation ? "待收下" : awaitingReply ? "等你回应" : { busy: "制作中", error: "有提示", done: "已收好", idle: "待命" }[phase];
  const phaseTone =
    phase === "busy"
      ? { dot: colors.accent, text: colors.accentText, tint: colors.accentTint }
      : phase === "error"
        ? { dot: colors.red, text: colors.redText, tint: colors.redTint }
        : phase === "done"
          ? { dot: colors.green, text: colors.greenText, tint: colors.greenTint }
          : { dot: colors.ink3, text: colors.ink2, tint: colors.inset };

  return (
    <Screen style={styles.screen}>
      <ScreenBar style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>工坊</Text>
          <Text style={styles.caption} numberOfLines={1}>
            {companionName} 帮你把心愿做成应用
          </Text>
        </View>
        <View style={[styles.phase, { backgroundColor: phaseTone.tint }]}>
          {phase === "busy" ? <PulseDot color={phaseTone.dot} /> : <View style={[styles.phaseDot, { backgroundColor: phaseTone.dot }]} />}
          <Text style={[styles.phaseText, { color: phaseTone.text }]}>{phaseLabel}</Text>
        </View>
      </ScreenBar>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // 保留视频的原生视图，滚出屏幕后回来时不重建播放表面。
        removeClippedSubviews={false}
      >
        {sessionId || sessionLoading ? (
          <Surface tone="inset" style={styles.sessionPanel}>
            <View style={styles.sessionSeal}><Icon name="edit" size={16} color={colors.accentText} /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.sessionTitle}>{sessionLoading ? "正在接回你的心愿" : "这一份心愿，我们接着做"}</Text>
              <Text style={styles.caption}>{awaitingConfirmation ? (workshopReady ? "正在体验这次作品，满意后亲自收下。" : "代码已完成，正在等待发布或加载。") : awaitingReply ? "伙伴在等你的回应，回复会留在这次制作里。" : "一次专心做好一件事，不会另开一份制作。"}</Text>
            </View>
            {!busy && !awaitingConfirmation && !awaitingReply ? (
              <Pressy accessibilityRole="button" disabled={sessionLoading} onPress={onNewSession} style={styles.sessionButton}>
                <Text style={styles.sessionButtonText}>接回心愿</Text>
              </Pressy>
            ) : null}
          </Surface>
        ) : hasSession ? (
          <Pressy accessibilityRole="button" onPress={onNewSession} style={styles.sessionButton}>
            <Text style={styles.sessionButtonText}>开启新的心愿</Text>
          </Pressy>
        ) : null}
        {awaitingConfirmation ? (
          <Animated.View entering={FadeInDown.duration(360)}>
            <Surface tone="raised" radius={colors.radius.xl} lifted style={styles.acceptance}>
              <GiltLine style={styles.reportEdge} />
              <View style={styles.reportHead}>
                <View style={styles.sessionSeal}><Icon name="check" size={17} color={colors.accentText} /></View>
                <Text style={styles.reportTitle}>先体验，再收下这份心愿</Text>
              </View>
              <Text style={styles.acceptanceText}>打开最新作品，看看它是否合你心意。确认收下后，我们会把这次修改合入主线，再陪你做下一个心愿。</Text>
              {confirmationMessage ? <Text accessibilityLiveRegion="polite" style={styles.acceptanceMessage}>{confirmationMessage}</Text> : null}
              <View style={styles.acceptanceActions}>
                <Pressy accessibilityRole="button" disabled={confirmationBusy} onPress={onLoadWish} style={styles.ghost}>
                  <Text style={styles.ghostText}>加载最新作品</Text>
                </Pressy>
                <Pressy accessibilityRole="button" disabled={confirmationBusy || !workshopReady} onPress={onConfirmWish} style={[styles.primary, (confirmationBusy || !workshopReady) && { opacity: 0.6 }]}>
                  <Text style={styles.primaryText}>{confirmationBusy ? "正在收好…" : "确认收下并合入"}</Text>
                </Pressy>
              </View>
              <Text style={styles.acceptanceHint}>收下时会核对你正在使用的版本，旧作品不能误确认。</Text>
            </Surface>
          </Animated.View>
        ) : null}
        {hasSession ? (
          <View style={styles.compactHero}>
            <View style={styles.portraitSmall}>
              <JollyVideoPlayer state={jollyLiveState} width={64} height={64} borderRadius={20} resizeMode="cover" />
            </View>
            <View style={styles.heroCopy}>
              <Pressy accessibilityRole="button" accessibilityLabel="修改昵称" onPress={openNameEditor} scale={0.97} style={styles.nameRow}>
                <Text style={styles.heroName}>{companionName}</Text>
                <Icon name="edit" size={15} color={colors.ink3} />
              </Pressy>
              <Text style={styles.heroStatus}>
                {stillRunning ? "正在把你的想法慢慢做好" : awaitingConfirmation ? (workshopReady ? "这次作品已打开，等你体验" : "代码完成，交付状态见上方提示") : awaitingReply ? "还有一句话想听你说" : hasError ? "遇到一点阻碍" : "这份心愿已经收好"}
              </Text>
            </View>
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(600)} style={styles.stage}>
            <View style={styles.portraitLarge}>
              <JollyVideoPlayer state={jollyLiveState} width={124} height={124} borderRadius={38} resizeMode="cover" />
            </View>
            <Text style={styles.stageTitle}>今天想做点什么？</Text>
            <Text style={styles.stageBody}>写下一个念头，{companionName} 会把它做成可以打开的小应用。</Text>
            <Pressy accessibilityRole="button" onPress={openNameEditor} scale={0.95} style={styles.renameChip}>
              <Icon name="edit" size={14} color={colors.ink3} />
              <Text style={styles.renameText}>给它改个名字</Text>
            </Pressy>
          </Animated.View>
        )}

        {prompt ? (
          <Animated.View entering={FadeInDown.duration(380)} layout={LinearTransition.duration(240)}>
            <Surface style={styles.wish}>
              <View style={styles.wishHead}>
                <Text style={styles.wishLabel}>心愿</Text>
                {!stillRunning ? (
                  <Pressy accessibilityRole="button" onPress={() => onChange(prompt)} hitSlop={8} scale={0.94}>
                    <Text style={styles.wishAction}>修改心愿</Text>
                  </Pressy>
                ) : null}
              </View>
              <Text style={styles.wishText}>{prompt}</Text>
            </Surface>
          </Animated.View>
        ) : null}

        {hasSession ? (
          <Animated.View entering={FadeInDown.duration(380).delay(60)} layout={LinearTransition.duration(240)}>
            <Surface tone="raised" style={styles.progress}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (actionTraces.length > 0) setTraceExpanded((open) => !open);
                }}
                style={styles.ticker}
              >
                <View style={styles.glyph}>
                  {stillRunning ? (
                    <JollyLoading size="sm" color={colors.accent} />
                  ) : (
                    <View style={[styles.glyphBadge, { backgroundColor: hasError ? colors.redTint : colors.greenTint }]}>
                      <Icon
                        name={hasError ? "alert" : "check"}
                        size={16}
                        color={hasError ? colors.redText : colors.greenText}
                        strokeWidth={2.1}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.tickerWindow}>
                  <Animated.View
                    key={currentTicker.key}
                    entering={FadeInDown.duration(240)}
                    exiting={FadeOutUp.duration(160)}
                    style={styles.tickerSlide}
                  >
                    <Text style={styles.tickerBadge}>{currentTicker.badge}</Text>
                    <Text style={[styles.tickerText, hasError && !stillRunning && { color: colors.redText }]} numberOfLines={1}>
                      {currentTicker.text}
                    </Text>
                  </Animated.View>
                </View>

                <View style={styles.tickerRight}>
                  {elapsedText ? <Text style={styles.elapsed}>{elapsedText}</Text> : null}
                  {actionTraces.length > 0 ? (
                    <View style={[styles.expand, traceExpanded && styles.expandOpen]}>
                      <Icon name="chevron" size={14} color={colors.ink3} strokeWidth={2} />
                    </View>
                  ) : null}
                </View>
              </Pressable>

              {traceExpanded && actionTraces.length > 0 ? (
                <Animated.View entering={FadeIn.duration(220)} style={styles.steps}>
                  <Text style={styles.stepsHead}>共 {actionTraces.length} 步，点一步看输出</Text>
                  {actionTraces.map((item, idx) => {
                    const cleanedDetail = cleanTraceDetail(item.detail);
                    const hasDetail = cleanedDetail.length > 0;
                    const rowOpen = expandedRowId === item.id;
                    const isLatest = idx === actionTraces.length - 1;
                    const isErr = item.state === "error";
                    const isRun = stillRunning && isLatest && item.state === "running" && !isErr;
                    const { chip, tone } =
                      item.kind === "tool"
                        ? classifyToolChip(item.title)
                        : item.title.includes("思考")
                          ? { chip: "思考", tone: "orchid" as const }
                          : { chip: "状态", tone: "cyan" as const };
                    const tint = toneColors(tone, colors);
                    const dotColor = isRun ? colors.accent : isErr ? colors.red : colors.green;
                    return (
                      <View key={item.id}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => (hasDetail ? setExpandedRowId(rowOpen ? null : item.id) : undefined)}
                          style={styles.step}
                        >
                          <View style={styles.stepRail}>
                            {isRun ? <PulseDot color={dotColor} /> : <View style={[styles.stepDot, { backgroundColor: dotColor }]} />}
                            {idx === actionTraces.length - 1 ? null : <View style={styles.stepLine} />}
                          </View>
                          <Text style={[styles.stepTitle, isErr && { color: colors.redText }]} numberOfLines={1}>
                            {item.title.trim()}
                          </Text>
                          <View style={[styles.stepChip, { backgroundColor: tint.tint }]}>
                            <Text style={[styles.stepChipText, { color: tint.text }]}>{chip}</Text>
                          </View>
                        </Pressable>
                        {rowOpen && hasDetail ? (
                          <Animated.View entering={FadeIn.duration(200)} style={styles.detail}>
                            <Text style={styles.detailText}>
                              {cleanedDetail.slice(0, 800)}
                              {cleanedDetail.length > 800 ? "\n… 已截断" : ""}
                            </Text>
                          </Animated.View>
                        ) : null}
                      </View>
                    );
                  })}
                </Animated.View>
              ) : null}
            </Surface>
          </Animated.View>
        ) : null}

        {hasSession && finalReport ? (
          <Animated.View entering={FadeInDown.duration(460).delay(80)} layout={LinearTransition.duration(240)}>
            <Surface tone="raised" radius={colors.radius.xl} lifted style={styles.report}>
              <GiltLine style={styles.reportEdge} />
              <View style={styles.reportHead}>
                <View style={styles.reportSeal}>
                  <Icon name="check" size={16} color={colors.onAccent} strokeWidth={2.4} />
                </View>
                <Text style={styles.reportTitle}>这次为你做了什么</Text>
              </View>
              <Text style={styles.reportText}>{finalReport}</Text>
              {!stillRunning && onBack ? (
                <View style={styles.reportActions}>
                  <Pressy accessibilityRole="button" onPress={onBack} style={styles.primary}>
                    <Text style={styles.primaryText}>去体验新应用</Text>
                  </Pressy>
                  {prompt && !sessionId ? (
                    <Pressy accessibilityRole="button" onPress={() => onChange(prompt)} style={styles.ghost}>
                      <Text style={styles.ghostText}>继续完善</Text>
                    </Pressy>
                  ) : null}
                </View>
              ) : null}
            </Surface>
          </Animated.View>
        ) : null}

        {!hasSession ? (
          <Animated.View entering={FadeIn.duration(600).delay(160)} style={styles.ideas}>
            <SectionTitle>试试这些</SectionTitle>
            {IDEAS.map((idea) => {
              const selected = value.trim() === idea.prompt.trim();
              return (
                <Pressy
                  key={idea.title}
                  accessibilityRole="button"
                  onPress={() => onChange(idea.prompt)}
                  scale={0.985}
                >
                  <Surface style={[styles.idea, selected && { borderColor: colors.accentSoft }]}>
                    <View style={styles.ideaHead}>
                      <Text style={styles.ideaTitle}>{idea.title}</Text>
                      <Text style={styles.ideaCategory}>{idea.category}</Text>
                      <View style={styles.ideaMark}>
                        <Icon
                          name={selected ? "check" : "plus"}
                          size={16}
                          color={selected ? colors.accentText : colors.ink3}
                          strokeWidth={selected ? 2.2 : 1.8}
                        />
                      </View>
                    </View>
                    <Text style={styles.ideaPrompt} numberOfLines={2}>
                      {idea.prompt}
                    </Text>
                  </Surface>
                </Pressy>
              );
            })}

            {report ? (
              <Pressable accessibilityRole="button" onPress={() => setShowLastSnapshot((prev) => !prev)}>
                <Surface tone="inset" style={styles.last}>
                  <View style={styles.lastHead}>
                    <Text style={styles.lastTitle}>上一次做出的应用</Text>
                    <View style={[styles.expand, showLastSnapshot && styles.expandOpen]}>
                      <Icon name="chevron" size={14} color={colors.ink3} strokeWidth={2} />
                    </View>
                  </View>
                  {showLastSnapshot ? (
                    <Animated.Text entering={FadeIn.duration(200)} style={styles.lastText}>
                      {cleanTraceDetail(report)}
                    </Animated.Text>
                  ) : null}
                </Surface>
              </Pressable>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>

      <PromptBar
        value={value}
        busy={busy}
        disabled={sessionLoading || confirmationBusy || Boolean(sessionId && !awaitingReply)}
        placeholder={awaitingConfirmation ? "先收下这份心愿，再开始下一个" : awaitingReply ? "把你的回应告诉伙伴" : "说说你想做什么小应用"}
        providers={AGENT_PROVIDERS}
        providerId={providerId}
        onProviderChange={onProviderChange}
        onChange={onChange}
        onSend={() => onSubmit()}
        onStop={onStop}
      />

      <Modal visible={nameModalVisible} transparent animationType="fade" onRequestClose={() => setNameModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setNameModalVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalWrap}>
            <Surface tone="raised" radius={colors.radius.xl} lifted style={styles.modalCard}>
              <Text style={styles.modalTitle}>给搭子起个名字</Text>
              <Text style={styles.modalHint}>它会出现在工坊里陪你做东西</Text>
              <TextInput
                style={styles.modalInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="例如：狗蛋、小助手"
                placeholderTextColor={colors.ink3}
                maxLength={12}
                autoFocus
                selectTextOnFocus
              />
              <View style={styles.modalActions}>
                <Pressy accessibilityRole="button" style={styles.modalCancel} onPress={() => setNameModalVisible(false)}>
                  <Text style={styles.modalCancelText}>取消</Text>
                </Pressy>
                <Pressy accessibilityRole="button" style={styles.modalSave} onPress={handleSaveName}>
                  <Text style={styles.modalSaveText}>保存</Text>
                </Pressy>
              </View>
            </Surface>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
});

/** 正在进行的事用一颗缓慢明灭的点表示，不用转圈。 */
function PulseDot({ color }: { color: string }) {
  const level = useSharedValue(1);
  useEffect(() => {
    level.value = withRepeat(withSequence(withTiming(0.3, { duration: 720 }), withTiming(1, { duration: 720 })), -1, false);
    return () => cancelAnimation(level);
  }, [level]);
  const motion = useAnimatedStyle(() => ({ opacity: level.value, transform: [{ scale: 0.8 + level.value * 0.3 }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }, motion]} />;
}

const styles = themedStyleSheet((t) => ({
  sessionSeal: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: t.accentTint,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptance: {
    padding: 18,
    gap: 14,
    overflow: "hidden",
  },
  acceptanceText: { color: t.ink2, fontSize: 14, lineHeight: 22 },
  acceptanceMessage: { color: t.accentText, fontSize: 13, lineHeight: 20 },
  acceptanceActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  acceptanceHint: { color: t.ink3, fontSize: 11, lineHeight: 17 },
  sessionPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
  },
  sessionTitle: {
    color: t.ink1,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  sessionButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: t.accentTint,
  },
  sessionButtonText: {
    color: t.accentText,
    fontSize: 12,
    fontWeight: "600",
  },
  screen: {
    backgroundColor: t.canvas,
  },
  fill: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
    backgroundColor: t.canvas,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontFamily: t.serif,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "700",
    color: t.ink1,
    letterSpacing: 2,
  },
  caption: {
    fontSize: 12.5,
    lineHeight: 17,
    color: t.ink3,
  },
  phase: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phaseText: {
    fontSize: 12.5,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 14,
  },
  stage: {
    alignItems: "center",
    paddingTop: 20,
    paddingBottom: 8,
    gap: 10,
  },
  portraitLarge: {
    width: 128,
    height: 128,
    borderRadius: 40,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: t.accentSoft,
    backgroundColor: t.surface,
    marginBottom: 6,
  },
  stageTitle: {
    fontFamily: t.serif,
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "700",
    color: t.ink1,
    letterSpacing: 1,
  },
  stageBody: {
    maxWidth: 280,
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: "center",
    color: t.ink3,
  },
  renameChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  renameText: {
    fontSize: 12.5,
    color: t.ink3,
  },
  compactHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 4,
  },
  portraitSmall: {
    width: 68,
    height: 68,
    borderRadius: 22,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: t.accentSoft,
    backgroundColor: t.surface,
  },
  heroCopy: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  heroName: {
    fontFamily: t.serif,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: t.ink1,
  },
  heroStatus: {
    fontSize: 13.5,
    color: t.ink2,
  },
  wish: {
    padding: 16,
    gap: 8,
    borderRadius: t.radius.xl,
  },
  wishHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  wishLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: t.accentText,
  },
  wishAction: {
    fontSize: 13,
    fontWeight: "600",
    color: t.ink2,
  },
  wishText: {
    fontFamily: t.serif,
    fontSize: 17,
    lineHeight: 27,
    color: t.ink1,
  },
  progress: {
    borderRadius: t.radius.xl,
  },
  ticker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  glyph: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  glyphBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tickerWindow: {
    flex: 1,
    minWidth: 0,
    height: 22,
    overflow: "hidden",
    justifyContent: "center",
  },
  tickerSlide: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tickerBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: t.accentText,
  },
  tickerText: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: "500",
    color: t.ink1,
  },
  tickerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  elapsed: {
    fontFamily: t.mono,
    fontSize: 12,
    color: t.ink3,
  },
  expand: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "90deg" }],
  },
  expandOpen: {
    transform: [{ rotate: "-90deg" }],
  },
  steps: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.line,
  },
  stepsHead: {
    paddingTop: 12,
    paddingBottom: 6,
    fontSize: 12,
    color: t.ink3,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 38,
  },
  stepRail: {
    width: 10,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepLine: {
    position: "absolute",
    top: 25,
    bottom: -15,
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: t.line,
  },
  stepTitle: {
    flex: 1,
    fontSize: 13.5,
    color: t.ink1,
  },
  stepChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stepChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  detail: {
    marginLeft: 22,
    marginBottom: 6,
    padding: 12,
    borderRadius: t.radius.md,
    backgroundColor: t.inset,
  },
  detailText: {
    fontFamily: t.mono,
    fontSize: 11.5,
    lineHeight: 17,
    color: t.ink2,
  },
  report: {
    padding: 18,
    gap: 12,
  },
  reportEdge: {
    position: "absolute",
    top: 0,
    left: 24,
    right: 24,
  },
  reportHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  reportSeal: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.accent,
  },
  reportTitle: {
    fontFamily: t.serif,
    fontSize: 19,
    fontWeight: "700",
    color: t.ink1,
  },
  reportText: {
    fontSize: 14.5,
    lineHeight: 23,
    color: t.ink2,
  },
  reportActions: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 4,
  },
  primary: {
    flex: 1,
    height: 46,
    borderRadius: t.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.accent,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: "700",
    color: t.onAccent,
  },
  ghost: {
    height: 46,
    paddingHorizontal: 20,
    borderRadius: t.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.lineStrong,
  },
  ghostText: {
    fontSize: 15,
    fontWeight: "600",
    color: t.ink1,
  },
  ideas: {
    gap: 10,
  },
  idea: {
    padding: 16,
    gap: 6,
    borderRadius: t.radius.xl,
  },
  ideaHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ideaTitle: {
    fontFamily: t.serif,
    fontSize: 17,
    fontWeight: "700",
    color: t.ink1,
  },
  ideaCategory: {
    flex: 1,
    fontSize: 12,
    color: t.accentText,
  },
  ideaMark: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.inset,
  },
  ideaPrompt: {
    fontSize: 13.5,
    lineHeight: 20,
    color: t.ink2,
  },
  last: {
    padding: 14,
    gap: 8,
    borderRadius: t.radius.lg,
  },
  lastHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: t.ink2,
  },
  lastText: {
    fontSize: 13.5,
    lineHeight: 21,
    color: t.ink2,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(8, 5, 12, 0.6)",
  },
  modalWrap: {
    width: "100%",
    maxWidth: 360,
  },
  modalCard: {
    padding: 22,
    gap: 8,
  },
  modalTitle: {
    fontFamily: t.serif,
    fontSize: 20,
    fontWeight: "700",
    color: t.ink1,
  },
  modalHint: {
    fontSize: 13.5,
    color: t.ink3,
    marginBottom: 8,
  },
  modalInput: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: t.radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.accentSoft,
    backgroundColor: t.field,
    color: t.ink1,
    fontSize: 16,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  modalCancel: {
    flex: 1,
    height: 46,
    borderRadius: t.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.lineStrong,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: t.ink2,
  },
  modalSave: {
    flex: 1,
    height: 46,
    borderRadius: t.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.accent,
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: "700",
    color: t.onAccent,
  },
}));
