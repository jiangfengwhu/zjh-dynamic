import { ApplicationIcon } from "../ApplicationIcon";
import { ActivityIndicator } from "react-native";
import { HostText as Text } from "./HostText";
import { useRef, useState } from "react";
import { View } from "react-native";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { Pressy } from "../../../../../packages/ui/chrome";
import { useTheme } from "../../../../../packages/ui/theme";
import type { ApplicationLink } from "./userPosts";


export function ApplicationPostCard({
  application,
  preview = false,
  onOpen,
}: {
  application: ApplicationLink;
  preview?: boolean;
  onOpen?: (appId: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
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
      accessibilityLabel={`查看应用 ${application.title}`}
      disabled={preview || busy}
      onPress={() => void open()}
      style={{
        paddingLeft: 10,
        paddingRight: 10,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: colors.components.surfaceBorder,
        borderColor: colors.lineStrong,
        backgroundColor: colors.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <ApplicationIcon application={{ manifest: application, iconUrl: application.iconUrl }} size={44} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, lineHeight: 19, fontWeight: "700", letterSpacing: -0.2, color: colors.ink1 }}
        >
          {application.title}
        </Text>
        {application.summary ? <Text
          numberOfLines={1}
          style={{ fontSize: 12, lineHeight: 16, color: colors.ink3 }}
        >
          {application.summary}
        </Text> : null}
      </View>
      {!preview ? (
        <View
          style={{
            minWidth: 52,
            height: 28,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: "700", color: colors.onAccent }}>打开</Text>
          )}
        </View>
      ) : null}
    </Pressy>
  );
}
