import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../../../packages/ui/theme";
import type { ApplicationLink } from "./userPosts";

export function ApplicationPostCard({ application, preview = false, onOpen }: { application: ApplicationLink; preview?: boolean; onOpen?: (appId: string) => Promise<void> }) {
  const { colors } = useTheme(); const [busy, setBusy] = useState(false); const working = useRef(false);
  async function open() {
    if (working.current) return; working.current = true; setBusy(true);
    try { await onOpen?.(application.appId); }
    catch (error) { Toast.show({ type: "error", text1: "应用暂时无法打开", text2: error instanceof Error ? error.message : "请稍后重试" }); }
    finally { working.current = false; setBusy(false); }
  }
  return <Pressable accessibilityRole="button" accessibilityLabel={`查看应用 ${application.title}`} disabled={preview || busy} onPress={() => void open()} style={{ marginTop: 6, padding: 14, borderRadius: 14, borderWidth: 0.5, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 12 }}>
    <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: `${application.accent}18`, alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 23, color: application.accent }}>{application.mark}</Text></View>
    <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.ink1 }}>{application.title}</Text><Text numberOfLines={2} style={{ fontSize: 12, lineHeight: 18, color: colors.ink3 }}>{application.summary || "打开应用市场，体验这个作品"}</Text><Text style={{ fontSize: 11, color: colors.accentText }}>应用市场 · {preview ? "随动态分享" : "查看并体验"}</Text></View>
    {!preview ? busy ? <ActivityIndicator size="small" color={colors.accent} /> : <ChevronRight size={18} color={colors.ink3} /> : null}
  </Pressable>;
}
