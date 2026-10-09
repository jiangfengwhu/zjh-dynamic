import { ApplicationIcon } from "../ApplicationIcon";
import { ActivityIndicator, View } from "react-native";
import { HostText as Text } from "./HostText";
import { useRef, useState } from "react";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { Pressy } from "../../../../../packages/ui/chrome";
import { SymbolIcon } from "../../../../../packages/ui/chrome/SymbolIcon";
import { useTheme } from "../../../../../packages/ui/theme";
import type { ApplicationLink } from "./userPosts";

/** Community, composer preview and private messages share one application card. */
export function ApplicationPostCard({ application, preview = false, onOpen, onDetail }: {
  application: ApplicationLink;
  preview?: boolean;
  onOpen?: (appId: string, params?: ApplicationLink["params"]) => Promise<void>;
  onDetail?: (appId: string) => void;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  async function open() {
    if (working.current) return;
    working.current = true; setBusy(true);
    try { await onOpen?.(application.appId, application.params); }
    catch (error) { Toast.show({ type: "error", text1: "应用暂时无法打开", text2: error instanceof Error ? error.message : "请稍后重试" }); }
    finally { working.current = false; setBusy(false); }
  }
  function detail() {
    if (onDetail) onDetail(application.appId);
    else {
      const { openPublicApplicationDetail } = require("../navigation") as typeof import("../navigation");
      openPublicApplicationDetail(application.appId);
    }
  }
  return <View style={{ padding: 10, borderRadius: 16, borderWidth: colors.components.surfaceBorder, borderColor: colors.lineStrong, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 8 }}>
    <Pressy scale={1} accessibilityRole="button" accessibilityLabel={`打开应用 ${application.title}`} disabled={preview || busy} onPress={() => void open()}
      style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.surface, overflow: "hidden" }}>
        <ApplicationIcon application={{ manifest: application, iconUrl: application.iconUrl }} size={44} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, lineHeight: 19, fontWeight: "700", letterSpacing: -0.2, color: colors.ink1 }}>{application.title}</Text>
        {application.summary ? <Text numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, color: colors.ink3 }}>{application.summary}</Text> : null}
      </View>
      {busy ? <ActivityIndicator size="small" color={colors.ink3} /> : null}
    </Pressy>
    {!preview ? <Pressy accessibilityRole="button" accessibilityLabel={`查看 ${application.title} 的详情`} onPress={detail}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" }}>
      <SymbolIcon name="info" size={20} color={colors.ink2} />
    </Pressy> : null}
  </View>;
}
