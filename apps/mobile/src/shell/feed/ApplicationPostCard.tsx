import { PixelText as Text } from "./PixelText";
import { useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { Pressy } from "../../../../../packages/ui/chrome";
import { useTheme } from "../../../../../packages/ui/theme";
import type { ApplicationLink } from "./userPosts";
import { pixelTheme } from "./pixelTheme";

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
  const inPixelFeed =
    context.colors.canvas === "#171322" || context.colors.canvas === "#F1EDF8";
  const colors = inPixelFeed ? pixelTheme(context.colors) : context.colors;
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
        marginTop: 3,
        padding: 5,
        borderRadius: inPixelFeed ? 0 : colors.radius.sm,
        borderWidth: inPixelFeed ? 2 : 0.5,
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
          应用市场 · {preview ? "随动态分享" : "查看并体验"}
        </Text>
      </View>
      {!preview ? (
        busy ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <ChevronRight size={18} color={colors.ink3} />
        )
      ) : null}
    </Pressy>
  );
}
