import { memo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
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
  screenshot,
  visibility,
  status,
  authorName,
  publishedAt,
  tone = 0,
  onOpen,
  actions,
}: {
  title: string;
  summary: string;
  mark?: string;
  screenshot?: string;
  visibility: "public" | "private";
  status?: string;
  authorName?: string;
  publishedAt?: number;
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
        marginBottom: 14,
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
            height: screenshot ? 150 : 92,
            backgroundColor: tint,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {screenshot ? (
            <AppImage
              source={{ uri: screenshot }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
              accessibilityLabel={`${title}的应用截图`}
            />
          ) : mark ? (
            <Text style={{ color: accent, fontSize: 38 }}>{mark}</Text>
          ) : (
            <PixelIcon name="box" size={38} color={accent} />
          )}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 12,
              top: 12,
              flexDirection: "row",
              gap: 4,
            }}
          >
            <View style={{ width: 6, height: 6, backgroundColor: accent }} />
            <View
              style={{ width: 6, height: 6, backgroundColor: colors.accent }}
            />
          </View>
          {busy ? (
            <ActivityIndicator
              style={{ position: "absolute", right: 14, bottom: 14 }}
              color={accent}
            />
          ) : null}
        </View>
        <View style={{ padding: 14, gap: 8 }}>
          <View
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}
          >
            <Text
              numberOfLines={2}
              style={{
                flex: 1,
                color: colors.ink1,
                fontSize: 18,
                lineHeight: 24,
                fontWeight: "700",
              }}
            >
              {title}
            </Text>
            <PixelIcon name="arrow" size={16} color={accent} />
          </View>
          {summary ? (
            <Text
              numberOfLines={2}
              style={{ color: colors.ink2, fontSize: 13, lineHeight: 20 }}
            >
              {summary}
            </Text>
          ) : null}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              flexWrap: "wrap",
            }}
          >
            <View
              style={{
                width: 5,
                height: 5,
                backgroundColor:
                  visibility === "public" ? colors.green : colors.orchid,
              }}
            />
            <Text
              style={{
                color: visibility === "public" ? colors.greenText : colors.ink3,
                fontSize: 11,
              }}
            >
              {visibility === "public" ? "公开作品" : "仅自己可见"}
            </Text>
            {status ? (
              <Text style={{ color: accent, fontSize: 11 }}>{status}</Text>
            ) : null}
            {publishedAt ? (
              <Text style={{ color: colors.ink3, fontSize: 11 }}>
                {new Date(publishedAt).toLocaleDateString()}
              </Text>
            ) : null}
            {authorName ? (
              <Text
                numberOfLines={1}
                style={{ color: colors.ink3, fontSize: 11, maxWidth: "45%" }}
              >
                {authorName}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressy>
      {actions ? (
        <View
          style={{
            paddingHorizontal: 14,
            paddingBottom: 8,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          {actions}
        </View>
      ) : null}
    </View>
  );
});
