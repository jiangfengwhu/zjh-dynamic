import { LoadingSkeleton } from "./LoadingSkeleton";
import { memo, useRef, useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";
import { Pressy } from "../../../../packages/ui/chrome";
import { AppImage } from "../../../../packages/ui/media/AppImage";
import { PixelText as Text } from "./feed/PixelText";
import { PixelIcon } from "./feed/PixelKit";
import { usePixelTheme } from "./feed/pixelTheme";

/** Public profiles and the owner's gallery share one honest presentation. */
export const WorkCard = memo(function WorkCard({
  title,
  summary,
  mark,
  visibility,
  status,
  authorName,
  authorAvatarUrl,
  tone = 0,
  onOpen,
  actions,
}: {
  title: string;
  summary: string;
  mark?: string;
  visibility: "public" | "private";
  status?: string;
  authorName?: string;
  authorAvatarUrl?: string | null;
  tone?: number;
  onOpen: () => void | Promise<unknown>;
  actions?: import("react").ReactNode;
}) {
  const { colors } = usePixelTheme();
  const [busy, setBusy] = useState(false);
  const acting = useRef(false);
  const tints = [
    colors.orchidTint,
    colors.greenTint,
    colors.redTint,
    colors.cyanTint,
  ];
  const accents = [
    colors.orchidText,
    colors.greenText,
    colors.redText,
    colors.cyanText,
  ];
  const tint = tints[tone % 4];
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
              backgroundColor: tint,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {mark ? (
              <Text style={{ color: accent, fontSize: 26 }}>{mark}</Text>
            ) : (
              <PixelIcon name="box" size={26} color={accent} />
            )}
            {busy ? (
              <LoadingSkeleton
                color={accent}
                style={{ position: "absolute", bottom: 0, right: 0 }}
              />
            ) : null}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text
              numberOfLines={2}
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
                numberOfLines={2}
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
          {authorAvatarUrl ? (
            <AppImage
              source={{ uri: authorAvatarUrl }}
              style={{ width: 22, height: 22, borderRadius: 11 }}
            />
          ) : (
            <PixelIcon name="mine" size={18} color={colors.ink3} />
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{ color: colors.ink3, fontSize: 11 }}
            >
              {authorName || "创作者"}
            </Text>
            {status ? (
              <Text numberOfLines={1} style={{ color: accent, fontSize: 10 }}>
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
