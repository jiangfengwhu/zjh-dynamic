import { Text } from "../../../../packages/ui/primitives/Typography";
import { ActivityIndicator } from "react-native";
import { syncNotificationCount } from "./feed/notifications";
import { memo, useEffect, useRef, useState } from "react";
import { Keyboard, View } from "react-native";
import PagerView, {
  type PagerViewOnPageScrollEvent,
  type PagerViewOnPageSelectedEvent,
} from "react-native-pager-view";
import Animated, {
  runOnJS,
  useEvent,
  useSharedValue,
} from "react-native-reanimated";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen, ScreenEdge } from "../../../../packages/ui/edge";
import { ThemeContext, useTheme } from "../../../../packages/ui/theme";

import type { UserPostDraft } from "../../../../packages/app-sdk/src/index";
import {
  type ComposePostControls,
  ComposePostScreen,
} from "./feed/ComposePostScreen";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { CompactTabs } from "./CompactTabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FormField } from "./FormField";
import { polishCreationPrompt } from "./creationDraft";
import { applicationContext } from "../../../../packages/app-sdk/src/runtime";
import { currentAccountId, useAccount } from "./account";
import { readShellValue, writeShellValue } from "./shellStorage";
import type { MarketApplication } from "./market";
import { CreationImages, useCreationImages } from "./CreationImages";
import type { CreationInput, CreationIntent } from "./creationComposer";
import { usePreventRemove } from "@react-navigation/native";
import { afterInteractions } from "./interactionWork";
import { useVisitedPager } from "./useVisitedPager";
import { useEventCallback } from "./useEventCallback";

const CREATION_INPUT_HEIGHT = 224;
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export function PublicationScreen(
  props: Parameters<typeof PublicationContent>[0]
) {
  const theme = useTheme();
  return (
    <ThemeContext.Provider value={theme}>
      <ScreenEdge bottom={false}>
        <PublicationContent {...props} />
      </ScreenEdge>
    </ThemeContext.Provider>
  );
}
function PublicationContent({
  onBack,
  initialApplication,
  initialDraft,
  initialMode,
  creation,
  onCreate,
  onSubmitting,
}: {
  onBack: () => void;
  initialApplication?: MarketApplication;
  initialDraft?: UserPostDraft;
  initialMode?: "post" | "create";
  creation?: CreationIntent;
  onCreate: (input: CreationInput) => Promise<string>;
  onSubmitting?: () => void;
}) {
  const lockedCreation = Boolean(creation);
  const startingMode = lockedCreation ? "create" : initialMode ?? (initialApplication || initialDraft ? "post" : "create");
  const [mode, setMode] = useState(startingMode);
  const { visited, visit, reveal } = useVisitedPager(startingMode === "create" ? 0 : 1);
  const { colors } = useTheme();
  const pager = useRef<PagerView>(null);
  const position = useSharedValue(
    startingMode === "create" ? 0 : 1
  );
  const [postControls, setPostControls] = useState<ComposePostControls>();
  const selectMode = useEventCallback((next: "post" | "create") => {
    if (next === mode) return;
    Keyboard.dismiss();
    setMode(next);
  });
  const onPageScroll = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      "worklet";
      reveal(event.position, event.offset);
      position.value = event.position + event.offset;
    },
    ["onPageScroll"]
  );
  const onPageSelected = useEvent<PagerViewOnPageSelectedEvent>(
    (event) => {
      "worklet";
      runOnJS(visit)(event.position);
      runOnJS(selectMode)(event.position === 0 ? "create" : "post");
    },
    ["onPageSelected"]
  );
  const [creating, setCreating] = useState(false);
  usePreventRemove(creating, () =>
    Toast.show({ type: "info", text1: "正在提交制作，请稍候" })
  );
  const creationPage = (
    <CreateApplicationPage
      key={creation?.appId ?? "new"}
      intent={creation}
      active={lockedCreation || mode === "create"}
      onCreate={onCreate}
      onSubmitting={onSubmitting}
      busy={creating}
      setBusy={setCreating}
    />
  );
  const tabs = (
    <View style={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8 }}>
      <CompactTabs
        position={position}
        value={mode}
        options={[
          { id: "create", label: "制作应用", icon: "spark" },
          { id: "post", label: "发动态", icon: "feed" },
        ]}
        onChange={(value) => {
          if (creating || postControls?.busy) return;
          visit(value === "create" ? 0 : 1);
          selectMode(value);
          pager.current?.setPage(value === "create" ? 0 : 1);
        }}
      />
    </View>
  );
  return (
    <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PageHeader
        title={
          lockedCreation ? (creation?.fork ? "Remix" : "修改应用") : "发布"
        }
        onBack={onBack}
        backDisabled={postControls?.busy || creating}
      />
      {lockedCreation ? (
        creationPage
      ) : (
        <>
          {tabs}
          <AnimatedPagerView
            ref={pager}
            style={{ flex: 1 }}
            initialPage={startingMode === "create" ? 0 : 1}
            offscreenPageLimit={1}
            overScrollMode="never"
            scrollEnabled={!creating && !postControls?.busy}
            onPageScroll={onPageScroll}
            onPageSelected={onPageSelected}
          >
            <View key="create" collapsable={false} style={{ flex: 1 }}>
              {visited.has(0) ? creationPage : null}
            </View>
            <View key="post" collapsable={false} style={{ flex: 1 }}>
              {visited.has(1) ? <ComposePostScreen
                embedded
                onControlsChange={setPostControls}
                onBack={onBack}
                initialApplication={initialApplication}
                initialDraft={initialDraft}
              /> : null}
            </View>
          </AnimatedPagerView>
        </>
      )}
    </Screen>
  );
}

const CreateApplicationPage = memo(function CreateApplicationPage({
  active,
  busy,
  setBusy,
  onCreate,
  onSubmitting,
  intent,
}: {
  active: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  intent?: CreationIntent;
  onCreate: (input: CreationInput) => Promise<string>;
  onSubmitting?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAccount();
  const scope = `${intent?.appId ?? "new"}.${intent?.fork ? "remix" : "edit"}`;
  const images = useCreationImages(user?.id, scope);
  const [submitStatus, setSubmitStatus] = useState("");
  const [prompt, setPrompt] = useState("");
  const [ready, setReady] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState("");
  const [beforePolish, setBeforePolish] = useState<string>();
  const polishRevision = useRef(0);
  function changePrompt(value: string) {
    typed.current = true;
    polishRevision.current++;
    setPolishing(false);
    setPolishError("");
    setPrompt(value);
  }
  useEffect(() => {
    polishRevision.current++;
    setPolishing(false);
    setPolishError("");
  }, [active]);
  useEffect(() => {
    polishRevision.current++;
    setPolishing(false);
    setPolishError("");
    setBeforePolish(undefined);
  }, [user?.id]);
  async function polish() {
    if (busy || polishing || !ready || !prompt.trim()) return;
    const source = prompt;
    const owner = user?.id;
    const id = ++polishRevision.current;
    setPolishing(true);
    setPolishError("");
    try {
      const result = await polishCreationPrompt(source);
      const currentOwner = await currentAccountId();
      if (
        !alive.current ||
        id !== polishRevision.current ||
        currentOwner !== owner
      )
        return;
      typed.current = true;
      setBeforePolish(source);
      setPrompt(result);
    } catch (cause) {
      if (alive.current && id === polishRevision.current)
        setPolishError(
          cause instanceof Error
            ? cause.message
            : "润色暂未完成，请重试；原文已保留"
        );
    } finally {
      if (alive.current && id === polishRevision.current) setPolishing(false);
    }
  }
  const acting = useRef(false);
  const typed = useRef(false);
  const alive = useRef(true);
  const draftKey = `creation.draft.${user?.id ?? "guest"}${
    intent ? `.${scope}` : ""
  }`;
  const loadedKey = useRef("");
  const latestDraft = useRef({ key: draftKey, text: prompt, loaded: false });
  const savedDraft = useRef<{ key: string; text: string } | undefined>(undefined);
  latestDraft.current = {
    key: draftKey,
    text: prompt,
    loaded: ready && loadedKey.current === draftKey,
  };
  function persistDraft() {
    const draft = latestDraft.current;
    if (draft.loaded && (savedDraft.current?.key !== draft.key || savedDraft.current.text !== draft.text)) {
      writeShellValue(draft.key, draft.text);
      savedDraft.current = { key: draft.key, text: draft.text };
    }
  }
  useEffect(
    () => () => {
      persistDraft();
      alive.current = false;
      polishRevision.current++;
    },
    []
  );
  useEffect(() => {
    let active = true;
    loadedKey.current = "";
    typed.current = false;
    setReady(false);
    setPrompt("");
    void readShellValue(draftKey)
      .then((value) => {
        if (active) {
          loadedKey.current = draftKey;
          if (!typed.current) setPrompt(intent?.prompt || value || "");
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          loadedKey.current = draftKey;
          setReady(true);
          Toast.show({
            type: "error",
            text1: "制作草稿未能恢复，可以重新输入",
          });
        }
      });
    return () => {
      active = false;
    };
  }, [draftKey]);
  useEffect(() => {
    if (!ready || loadedKey.current !== draftKey) return;
    const timer = setTimeout(() => {
      if (loadedKey.current === draftKey) persistDraft();
    }, 180);
    return () => clearTimeout(timer);
  }, [ready, draftKey, prompt]);
  async function create() {
    if (
      acting.current ||
      images.picking ||
      !images.ready ||
      !ready ||
      !prompt.trim() ||
      !user
    )
      return;
    persistDraft();
    polishRevision.current++;
    setPolishing(false);
    acting.current = true;
    setBusy(true);
    setSubmitStatus("正在准备制作…");
    const owner = user.id;
    const submittedText = prompt.trim();
    try {
      if ((await currentAccountId()) !== owner)
        throw new Error("账号已改变，请重新打开发布页");
      Keyboard.dismiss();
      const uploaded = await images.upload((status) => {
        if (alive.current) setSubmitStatus(status);
      });
      if ((await currentAccountId()) !== owner)
        throw new Error("账号已改变，请重新打开制作页");
      setSubmitStatus("正在提交需求…");
      const submission = new Promise<string>((resolve, reject) => {
        requestAnimationFrame(() => {
          if (alive.current) onSubmitting?.();
          afterInteractions(() => {
            void Promise.resolve().then(() => onCreate({ prompt: submittedText, images: uploaded })).then(resolve, reject);
          });
        });
      });
      // The request owns its promise after the composer leaves. Do not make the
      // user wait for Jules to create/continue a session or for notification sync.
      setBusy(false);
      Toast.show({ type: "info", text1: "正在后台提交制作需求", text2: "提交结果会提示你，失败时草稿保留" });
      const createdAppId = await submission;
      if (!createdAppId) throw new Error("需求未能提交，草稿已保留");
      if ((await currentAccountId()) !== owner) {
        return;
      }
      if ((await currentAccountId()) === owner) {
        Toast.show({
          type: "success",
          text1: intent ? "修改需求已提交" : "制作需求已提交",
          text2: "Jolly 已收到，完成或失败都会通知你",
        });
        requestIdleCallback(() => void syncNotificationCount().catch(() => {}));
        if ((!alive.current || latestDraft.current.text.trim() === submittedText) &&
          (await readShellValue(draftKey))?.trim() === submittedText && images.clear()) {
          writeShellValue(draftKey, "");
          if (alive.current) {
            changePrompt("");
            setBeforePolish(undefined);
          }
        }
      }
    } catch (cause) {
      if ((await currentAccountId()) === owner)
        Toast.show({
          type: "error",
          text1: "制作未能开始",
          text2: cause instanceof Error ? cause.message : "请重试",
        });
    } finally {
      acting.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <View style={{ flex: 1 }}>
    <KeyboardAwareScrollView
      // The action dock stays outside the scrolling form.
      bottomOffset={24}
      style={{ flex: 1 }}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 16,
        gap: 12,
        paddingBottom: 12 + insets.bottom,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: colors.ink1, fontSize: 15, fontWeight: "700", letterSpacing: -0.2 }}
        >
          {intent
            ? `${intent.fork ? "Remix" : "修改"} · ${intent.title}`
            : "你的想法"}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressy
            scale={1}
            accessibilityRole="button"
            accessibilityLabel={polishing ? "取消润色" : "AI 润色需求"}
            disabled={busy || !ready || !prompt.trim() || !user}
            onPress={() => {
              if (polishing) {
                polishRevision.current++;
                setPolishing(false);
              } else void polish();
            }}
            style={{
              minHeight: 30,
              paddingHorizontal: 12,
              borderRadius: 15,
              backgroundColor: colors.orchidTint,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            {polishing ? (
              <ActivityIndicator size="small" color={colors.orchidText} />
            ) : (
              <SymbolIcon name="spark" size={14} strokeWidth={2.1} color={colors.orchid} />
            )}
            <Text style={{ color: colors.orchidText, fontSize: 12, fontWeight: "700" }}>
              {polishing ? "取消润色" : "AI 润色"}
            </Text>
          </Pressy>
          {beforePolish !== undefined ? (
            <Pressy
              scale={1}
              accessibilityRole="button"
              accessibilityLabel="回退到润色前的原文"
              disabled={busy}
              onPress={() => {
                changePrompt(beforePolish);
                setBeforePolish(undefined);
              }}
              style={{
                minHeight: 44,
                paddingHorizontal: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              <SymbolIcon name="back" size={14} color={colors.ink2} />
              <Text style={{ color: colors.ink2, fontSize: 13, fontWeight: "600" }}>
                回退原文
              </Text>
            </Pressy>
          ) : null}
        </View>
      </View>
      <FormField
        accessibilityLabel="应用制作需求"
        multiline
        scrollEnabled
        editable={!busy}
        maxLength={8000}
        value={prompt}
        onChangeText={changePrompt}
        onBlur={persistDraft}
        placeholder={
          intent
            ? "希望哪里改变？描述目标效果，也可以添加问题截图…"
            : "例如：做一个每天记录心情的小应用，有日历和心情趋势…"
        }
        placeholderTextColor={colors.ink3}
        style={{
          height: CREATION_INPUT_HEIGHT,
          padding: 14,
          borderRadius: colors.radius.xl,
          borderWidth: colors.mode === "dark" ? colors.components.surfaceBorder : 0,
          borderColor: colors.line,
          backgroundColor: colors.surface,
          boxShadow: colors.shadow.card,
          color: colors.ink1,
          fontSize: 15,
          lineHeight: 23,
          textAlignVertical: "top",
        }}
      />
      <CreationImages images={images} disabled={busy} />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text style={{ flex: 1, color: colors.ink3, fontSize: 12 }}>
          {polishing
            ? "正在润色，你仍可编辑或直接开始制作"
            : "输入内容自动保存，AI 润色可选"}
        </Text>
        <Text style={{ color: colors.ink3, fontSize: 11 }}>
          {prompt.length}/8000
        </Text>
      </View>
      {polishError ? (
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.redText, fontSize: 12 }}>
            {polishError}
          </Text>
          {/配置|引擎/.test(polishError) ? (
            <Pressy
              accessibilityRole="button"
              onPress={() => applicationContext("jolly").ai.openSettings()}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: colors.orchidText, fontSize: 13 }}>
                配置 AI 引擎
              </Text>
            </Pressy>
          ) : null}
        </View>
      ) : null}

      <Text style={{ color: colors.ink3, fontSize: 12 }}>
        点击后需求和参考图会交给制作服务；作品发布成功后会收到站内通知，制作进度可手动刷新。
      </Text>
    </KeyboardAwareScrollView>
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 + insets.bottom }}>
      <Pressy
        accessibilityRole="button"
        accessibilityLabel="提交需求并开始制作"
        disabled={
          busy ||
          images.picking ||
          !images.ready ||
          !ready ||
          !prompt.trim() ||
          !user
        }
        onPress={() => void create()}
        style={{
          minHeight: 46,
          borderRadius: 23,
          experimental_backgroundImage: colors.aurora,
          boxShadow: "0 6px 18px rgba(255,61,139,0.32)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity:
            busy ||
            images.picking ||
            !images.ready ||
            !ready ||
            !prompt.trim() ||
            !user
              ? 0.4
              : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <SymbolIcon name="spark" size={17} strokeWidth={2.2} color="#FFFFFF" />
        )}
        <Text
          style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "800", letterSpacing: -0.1 }}
        >
          {busy ? submitStatus : "进入制作"}
        </Text>
      </Pressy>
    </View>
    </View>
  );
});
