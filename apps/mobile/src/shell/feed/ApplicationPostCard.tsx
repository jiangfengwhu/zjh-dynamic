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
        paddingLeft: 12,
        paddingRight: 12,
        paddingVertical: 12,
        borderRadius: 18,
        backgroundColor: colors.surfaceRaised,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          backgroundColor: "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ApplicationIcon application={{ manifest: application, iconUrl: application.iconUrl }} size={48} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 15, lineHeight: 21, fontWeight: "700", color: colors.ink1 }}
        >
          {application.title}
        </Text>
        {application.summary ? <Text
          numberOfLines={1}
          style={{ fontSize: 13, lineHeight: 18, color: colors.ink3 }}
        >
          {application.summary}
        </Text> : null}
      </View>
      {!preview ? (
        <View
          style={{
            minWidth: 56,
            height: 32,
            paddingHorizontal: 14,
            borderRadius: 16,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={{ fontSize: 13, lineHeight: 18, fontWeight: "700", color: colors.accentText }}>打开</Text>
          )}
        </View>
      ) : null}
    </Pressy>
  );
}
