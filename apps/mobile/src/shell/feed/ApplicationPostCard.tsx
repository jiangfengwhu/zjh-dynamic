import { ActivityIndicator } from "react-native";
import { PixelText as Text } from "./PixelText";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { SymbolIcon } from "./PixelKit";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { Pressy } from "../../../../../packages/ui/chrome";
import { useTheme } from "../../../../../packages/ui/theme";
import type { ApplicationLink } from "./userPosts";

import { isApplicationInstalled } from "../market";
import { subscribeCatalog } from "../catalog";
import { useAccount } from "../account";

export function ApplicationPostCard({
  application,
  preview = false,
  onOpen,
}: {
  application: ApplicationLink;
  preview?: boolean;
  onOpen?: (appId: string) => Promise<void>;
}) {
  const context = useTheme();
  const inPixelFeed = ["#171322", "#F1EDF8", "#19152C", "#FFF9ED"].includes(
    context.colors.canvas
  );
  const colors = inPixelFeed ? context.colors : context.colors;
  const [busy, setBusy] = useState(false);
  const [installed, setInstalled] = useState(false);
  const { user } = useAccount();
  useEffect(() => {
    if (preview) return;
    let alive = true;
    const refresh = () => {
      void isApplicationInstalled(application.appId)
        .then((value) => {
          if (alive) setInstalled(value);
        })
        .catch(() => {});
    };
    setInstalled(false);
    refresh();
    const off = subscribeCatalog(refresh);
    return () => {
      alive = false;
      off();
    };
  }, [application.appId, preview, user?.id]);
  const working = useRef(false);
  async function open() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await onOpen?.(application.appId);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "应用暂时无法打开",
        text2: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      working.current = false;
      setBusy(false);
    }
  }
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel={`${installed ? "打开" : "查看"}应用 ${
        application.title
      }`}
      disabled={preview || busy}
      onPress={() => void open()}
      style={{
        marginTop: 3,
        padding: 5,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: colors.line,
        backgroundColor: inPixelFeed ? colors.inset : undefined,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: `${application.accent}18`,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 23, color: application.accent }}>
          {application.mark}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1.5 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "700", color: colors.ink1 }}
        >
          {application.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontSize: 12, lineHeight: 18, color: colors.ink3 }}
        >
          {application.summary || "打开应用市场，体验这个作品"}
        </Text>
        <Text style={{ fontSize: 11, color: colors.accentText }}>
          {preview
            ? "随动态分享"
            : installed
            ? "已安装 · 直接打开"
            : "应用市场 · 查看并体验"}
        </Text>
      </View>
      {!preview ? (
        busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <SymbolIcon name="arrow" size={18} color={colors.ink3} />
        )
      ) : null}
    </Pressy>
  );
}
