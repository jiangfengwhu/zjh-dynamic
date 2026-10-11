import { ApplicationIcon } from "./ApplicationIcon";
import { UserAvatar } from "./UserAvatar";
import { ActivityIndicator } from "react-native";
import { memo, useRef } from "react";
import { useRecyclingState } from "@shopify/flash-list";
import { View } from "react-native";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { Pressy } from "../../../../packages/ui/chrome";
import { HostText as Text } from "./feed/HostText";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { useTheme } from "../../../../packages/ui/theme";

/** Public profiles and the owner's gallery share one honest presentation. */
export const WorkCard = memo(function WorkCard({
  appId,
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
  headerAction,
}: {
  appId?: string;
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
  headerAction?: import("react").ReactNode;
}) {
  const { colors } = useTheme();
  const acting = useRef(false);
  const itemId = appId ?? application?.manifest.appId ?? title;
  const identity = useRef({ id: itemId });
  if (identity.current.id !== itemId) identity.current = { id: itemId };
  const [busy, setBusy] = useRecyclingState(false, [itemId], () => { acting.current = false; });
  const accents = [
    colors.orchidText,
    colors.greenText,
    colors.redText,
    colors.cyanText,
  ];
  const accent = accents[tone % 4];
  async function open() {
    if (acting.current) return;
    const operation = identity.current;
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
      if (identity.current === operation) {
        acting.current = false;
        setBusy(false);
      }
    }
  }
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: colors.radius.xl,
        borderWidth: colors.mode === "dark" ? colors.components.surfaceBorder : 0,
        borderColor: colors.line,
        boxShadow: colors.shadow.card,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Pressy
        style={{ flex: 1, minWidth: 0 }}
        scale={0.99}
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
            paddingBottom: 6,
            gap: 10,
          }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 13,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              backgroundColor: colors.surfaceRaised,
            }}
          >
            {application ? <ApplicationIcon application={application} size={46} /> : <SymbolIcon name="box" size={22} color={accent} />}
            {busy ? (
              <ActivityIndicator
                color={accent}
                style={{ position: "absolute", bottom: 0, right: 0 }}
              />
            ) : null}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.ink1,
                fontSize: 15,
                lineHeight: 20,
                fontWeight: "700",
                letterSpacing: -0.3,
              }}
            >
              {title}
            </Text>
            {summary ? (
              <Text
                numberOfLines={1}
                style={{ color: colors.ink3, fontSize: 12, lineHeight: 17 }}
              >
                {summary}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressy>
      {headerAction}
      </View>
      <View
        style={{
          paddingLeft: 12,
          paddingRight: 4,
          paddingBottom: 2,
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
          <UserAvatar uri={authorAvatarUrl} size={18} />
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              numberOfLines={1}
              style={{ color: colors.ink3, fontSize: 12, flexShrink: 1 }}
            >
              {authorName || "创作者"}
            </Text>
            {status ? (
              <Text numberOfLines={1} style={{ color: colors.ink2, fontSize: 11, fontWeight: "600", flexShrink: 0, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 8, backgroundColor: colors.surfaceRaised, overflow: "hidden" }}>
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
