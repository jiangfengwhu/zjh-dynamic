import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  ScrollView,
  Text,
  View,
} from "react-native";
import Toast from "react-native-toast-message";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { useTheme } from "../../../../packages/ui/theme";
import type { UserPostDraft } from "../../../../packages/app-sdk/src/index";
import { ComposePostScreen } from "./feed/ComposePostScreen";
import { PixelAvatar, PixelIcon } from "./feed/PixelKit";
import { CompactTabs } from "./CompactTabs";
import { FormField } from "./FormField";
import { currentAccountId, useAccount } from "./account";
import { readShellValue, writeShellValue } from "./shellStorage";
import type { MarketApplication } from "./market";

export function PublicationScreen({
  onBack,
  initialApplication,
  initialDraft,
  initialMode = "post",
  onCreate,
}: {
  onBack: () => void;
  initialApplication?: MarketApplication;
  initialDraft?: UserPostDraft;
  initialMode?: "post" | "create";
  onCreate: (prompt: string) => Promise<boolean>;
}) {
  const [mode, setMode] = useState(initialMode);
  const [postOpened, setPostOpened] = useState(initialMode === "post");
  const [creating, setCreating] = useState(false);
  const tabs = (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      <CompactTabs
        value={mode}
        options={[
          { id: "post", label: "发动态" },
          { id: "create", label: "制作应用" },
        ]}
        onChange={(value) => {
          if (creating) return;
          Keyboard.dismiss();
          setMode(value);
          if (value === "post") setPostOpened(true);
        }}
      />
    </View>
  );
  return (
    <View style={{ flex: 1 }}>
      {postOpened ? (
        <View style={{ flex: 1, display: mode === "post" ? "flex" : "none" }}>
          <ComposePostScreen
            onBack={onBack}
            initialApplication={initialApplication}
            initialDraft={initialDraft}
            modeTabs={tabs}
          />
        </View>
      ) : null}
      <View style={{ flex: 1, display: mode === "create" ? "flex" : "none" }}>
        <CreateApplicationPage
          onCreate={onCreate}
          onBack={onBack}
          tabs={tabs}
          busy={creating}
          setBusy={setCreating}
        />
      </View>
    </View>
  );
}

function CreateApplicationPage({
  onBack,
  tabs,
  busy,
  setBusy,
  onCreate,
}: {
  onBack: () => void;
  tabs: import("react").ReactNode;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCreate: (prompt: string) => Promise<boolean>;
}) {
  const { colors } = useTheme();
  const { user } = useAccount();
  const [prompt, setPrompt] = useState("");
  const [ready, setReady] = useState(false);
  const acting = useRef(false);
  const typed = useRef(false);
  const alive = useRef(true);
  const draftKey = `creation.draft.${user?.id ?? "guest"}`;
  useEffect(
    () => () => {
      alive.current = false;
    },
    []
  );
  useEffect(() => {
    let active = true;
    typed.current = false;
    setReady(false);
    setPrompt("");
    void readShellValue(draftKey)
      .then((value) => {
        if (active) {
          if (!typed.current) setPrompt(value || "");
          setReady(true);
        }
      })
      .catch(() => {
        if (active) {
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
    if (ready) writeShellValue(draftKey, prompt);
  }, [ready, draftKey, prompt]);
  async function create() {
    if (acting.current || !prompt.trim() || !user) return;
    acting.current = true;
    setBusy(true);
    const owner = user.id;
    try {
      if ((await currentAccountId()) !== owner)
        throw new Error("账号已改变，请重新打开发布页");
      Keyboard.dismiss();
      if (!(await onCreate(prompt.trim())))
        throw new Error("工坊未能打开，需求草稿已保留");
    } catch (cause) {
      if (alive.current)
        Toast.show({
          type: "error",
          text1: "工坊未能打开",
          text2: cause instanceof Error ? cause.message : "请重试",
        });
    } finally {
      acting.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <Screen style={{ flex: 1, backgroundColor: colors.canvas }}>
      <PageHeader title="发布" onBack={busy ? undefined : onBack} />
      {tabs}
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 16 }}
      >
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <PixelAvatar size={52} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{ color: colors.ink1, fontSize: 20, fontWeight: "700" }}
            >
              把想法做成应用
            </Text>
            <Text style={{ color: colors.ink3, fontSize: 13 }}>
              告诉 Jolly 你想解决的一件小事。
            </Text>
          </View>
        </View>
        <FormField
          accessibilityLabel="应用制作需求"
          multiline
          editable={!busy}
          maxLength={8000}
          value={prompt}
          onChangeText={(value) => {
            typed.current = true;
            setPrompt(value);
          }}
          placeholder="例如：做一个每天记录心情的小应用，有日历和像素花园…"
          placeholderTextColor={colors.ink3}
          style={{
            minHeight: 180,
            padding: 14,
            borderRadius: 16,
            borderWidth: 0.5,
            borderColor: colors.line,
            backgroundColor: colors.inset,
            color: colors.ink1,
            fontSize: 15,
            lineHeight: 23,
            textAlignVertical: "top",
          }}
        />
        <Text style={{ color: colors.ink3, fontSize: 12 }}>
          描述用途、想要的界面和关键功能；草稿会自动保存。
        </Text>
        <Pressy
          accessibilityRole="button"
          accessibilityLabel="进入 Jolly 制作工坊"
          disabled={busy || !ready || !prompt.trim()}
          onPress={() => void create()}
          style={{
            minHeight: 48,
            borderRadius: 24,
            backgroundColor: colors.accent,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: busy || !ready || !prompt.trim() ? 0.5 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <PixelIcon name="spark" size={20} color={colors.onAccent} />
          )}
          <Text
            style={{ color: colors.onAccent, fontSize: 15, fontWeight: "700" }}
          >
            {busy ? "正在准备工坊…" : "进入制作"}
          </Text>
        </Pressy>
        <Text style={{ color: colors.ink3, fontSize: 12 }}>
          在工坊中确认并开始制作，完成或失败都会收到站内通知。
        </Text>
      </ScrollView>
    </Screen>
  );
}
