import { ApplicationIcon } from "./ApplicationIcon";
import { UserAvatar } from "./UserAvatar";
import { ActivityIndicator } from "react-native";
import { memo, useRef, useState } from "react";
import { View } from "react-native";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { Pressy } from "../../../../packages/ui/chrome";
import { PixelText as Text } from "./feed/PixelText";
import { SymbolIcon } from "./feed/PixelKit";
import { useTheme } from "../../../../packages/ui/theme";

/** Public profiles and the owner's gallery share one honest presentation. */
export const WorkCard = memo(function WorkCard({
  application,
  title,
  summary,
  visibility,
  status,
  authorName,
  authorAvatarUrl,
  tone = 0,
  onOpen,
  actions,
}: {
  application?: Parameters<typeof ApplicationIcon>[0]["application"];
  title: string;
  summary: string;
  visibility: "public" | "private";
  status?: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  tone?: number;
  onOpen: () => void | Promise<unknown>;
  actions?: import("react").ReactNode;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const accents = [
    colors.orchidText,
    colors.greenText,
    colors.redText,
    colors.cyanText,
  ];
  const accent = accents[tone % 4];
  async function open() {
    if (acting.current) return;
    acting.current = true;
    setBusy(true);
    try {
      await onOpen();
    } catch (cause) {
      Toast.show({
        type: "error",
        text1: "作品未能打开",
        text2: cause instanceof Error ? cause.message : "请重试",
      });
    } finally {
      acting.current = false;
      setBusy(false);
    }
  }
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: colors.line,
        overflow: "hidden",
        marginBottom: 6,
      }}
    >
      <Pressy
        scale={1}
        accessibilityRole="button"
        accessibilityLabel={`查看作品 ${title}，${
          visibility === "public" ? "公开作品" : "仅自己可见"
        }`}
        disabled={busy}
        onPress={() => void open()}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 12,
            paddingTop: 12,
            paddingBottom: 4,
            gap: 10,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {application ? <ApplicationIcon application={application} size={48} /> : <SymbolIcon name="box" size={26} color={accent} />}
            {busy ? (
              <ActivityIndicator
                color={accent}
                style={{ position: "absolute", bottom: 0, right: 0 }}
              />
            ) : null}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.ink1,
                fontSize: 16,
                lineHeight: 22,
                fontWeight: "700",
              }}
            >
              {title}
            </Text>
            {summary ? (
              <Text
                numberOfLines={1}
                style={{ color: colors.ink2, fontSize: 12, lineHeight: 18 }}
              >
                {summary}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressy>
      <View
        style={{
          paddingLeft: 12,
          paddingRight: 6,
          paddingBottom: 4,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Pressy
          scale={1}
          accessibilityLabel={`查看作品 ${title}`}
          onPress={() => void open()}
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 6,
          }}
        >
          <UserAvatar uri={authorAvatarUrl} size={22} />
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{ color: colors.ink3, fontSize: 11, flexShrink: 1 }}
            >
              {authorName || "创作者"}
            </Text>
            {status ? (
              <Text numberOfLines={1} style={{ color: accent, fontSize: 10, flexShrink: 0 }}>
                {status}
              </Text>
            ) : null}
          </View>
        </Pressy>
        {actions ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            {actions}
          </View>
        ) : null}
      </View>
    </View>
  );
});
