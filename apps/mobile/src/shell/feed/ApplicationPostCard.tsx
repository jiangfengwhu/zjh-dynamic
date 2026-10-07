import { ApplicationIcon } from "../ApplicationIcon";
import { ActivityIndicator } from "react-native";
import { PixelText as Text } from "./PixelText";
import { useRef, useState } from "react";
import { View } from "react-native";
import { SymbolIcon } from "./PixelKit";
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
      accessibilityLabel={`${installed ? "打开" : "查看"}应用 ${
        application.title
      }`}
      disabled={preview || busy}
      onPress={() => void open()}
      style={{
        marginTop: 3,
        paddingHorizontal: 12,
        paddingVertical: 5,
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
        <ApplicationIcon application={{ manifest: application, iconUrl: application.iconUrl }} size={44} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1.5 }}>
        <Text
          numberOfLines={1}
          style={{ fontSize: 14, fontWeight: "700", color: colors.ink1 }}
        >
          {application.title}
        </Text>
        {application.summary ? <Text
          numberOfLines={1}
          style={{ fontSize: 12, lineHeight: 18, color: colors.ink3 }}
        >
          {application.summary}
        </Text> : null}
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
