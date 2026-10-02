import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { usePreventRemove } from "@react-navigation/native";
import ImagePicker from "react-native-image-crop-picker";
import FastImage from "@d11/react-native-fast-image";
import Toast from "react-native-toast-message";
import { BackChip, Pressy } from "../../../../packages/ui/chrome";
import { Screen, ScreenBar } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { currentAccountId, uploadFeedbackScreenshot } from "./account";
import { readShellValue, writeShellValue, removeShellValue } from "./shellStorage";
import { fetchPublicMarketApplication } from "./market";
import { openApplicationWorkshop } from "./workshopNavigation";
import type { ApplicationManifest } from "../runtime/applications";

type Photo = { path?: string; url?: string };
export function ApplicationFeedbackScreen({ manifest, ownerId, onBack }: { manifest: ApplicationManifest; ownerId: string; onBack: () => void }) {
  const { colors } = useTheme(); const key = `feedback.draft.${ownerId}.${manifest.appId}.${manifest.releaseId}`;
  const [body, setBody] = useState(""); const [photos, setPhotos] = useState<Photo[]>([]); const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(""); const [error, setError] = useState(""); const [ready, setReady] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const alive = useRef(true); const working = useRef(false); const files = useRef(new Set<string>());
  usePreventRemove(busy && !handoff, () => Toast.show({ type: "info", text1: "正在处理反馈，请稍候" }));
  useEffect(() => {
    void readShellValue(key).then(raw => { if (!alive.current) return; try { const cached = JSON.parse(raw || "null"); if (typeof cached?.body === "string") setBody(cached.body); if (Array.isArray(cached?.images)) setPhotos(cached.images.filter((url: unknown) => typeof url === "string" && url.startsWith("https://")).slice(0, 3).map((url: string) => ({ url }))); } catch {} setReady(true); });
    return () => { alive.current = false; for (const path of files.current) void ImagePicker.cleanSingle(path).catch(() => {}); };
  }, []);
  useEffect(() => { if (ready) writeShellValue(key, JSON.stringify({ body, images: photos.flatMap(photo => photo.url ? [photo.url] : []) })); }, [body, photos, ready]);
  async function choose() {
    if (working.current || photos.length >= 3) return;
    working.current = true; setBusy(true); setError(""); setStatus("正在选择截图…");
    try {
      if (await currentAccountId() !== ownerId) throw new Error("账号已改变，请重新打开反馈页");
      const images = await ImagePicker.openPicker({ mediaType: "photo", multiple: true, maxFiles: 3 - photos.length, forceJpg: true, compressImageMaxWidth: 1600, compressImageMaxHeight: 2400, compressImageQuality: 0.75 });
      for (const image of images) files.current.add(image.path);
      if (!alive.current) { for (const image of images) void ImagePicker.cleanSingle(image.path).catch(() => {}); return; }
      if (await currentAccountId() !== ownerId) throw new Error("账号已改变，请重新打开反馈页");
      if (images.length > 3 - photos.length || images.some(image => image.size > 2 * 1024 * 1024)) throw new Error("最多三张截图，每张压缩后需小于 2 MB");
      setPhotos(previous => [...previous, ...images.map(image => ({ path: image.path }))]);
    } catch (e) { if (alive.current && (e as { code?: string }).code !== "E_PICKER_CANCELLED") { const message = e instanceof Error ? e.message : "截图选择失败"; setError(message); Toast.show({ type: "error", text1: message }); } }
    finally { working.current = false; if (alive.current) { setBusy(false); setStatus(""); } }
  }
  async function prepare() {
    if (working.current || !body.trim() || !ready) return;
    working.current = true; setBusy(true); setError(""); setStatus("正在准备反馈…");
    try {
      if (await currentAccountId() !== ownerId) throw new Error("账号已改变，请重新打开反馈页");
      const owned = await readShellValue(`shell.jules.apps.${manifest.appId}.owner`) === ownerId;
      const originalRelease = owned ? manifest.releaseId : (await fetchPublicMarketApplication(manifest.appId)).manifest.releaseId;
      const urls: string[] = [];
      for (let index = 0; index < photos.length; index++) {
        const photo = photos[index]; setStatus(`正在准备截图 ${index + 1}/${photos.length}…`);
        const url = photo.url || await uploadFeedbackScreenshot(manifest.appId, manifest.releaseId, photo.path!);
        if (!alive.current || await currentAccountId() !== ownerId) throw new Error("账号已改变，请重试");
        urls.push(url); setPhotos(previous => previous.map((item, i) => i === index ? { ...item, url } : item));
      }
      if (await currentAccountId() !== ownerId) throw new Error("账号已改变，请重试");
      setHandoff(true);
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const target = await openApplicationWorkshop(manifest.appId, manifest.title, !owned, false, originalRelease, { appId: manifest.appId, releaseId: manifest.releaseId, title: manifest.title, body: body.trim(), images: urls }, ownerId);
      if (!target) throw new Error("请登录后再将反馈带回工坊");
      removeShellValue(key);
    } catch (e) { if (alive.current) { const message = e instanceof Error ? e.message : "反馈未能带回工坊，请重试"; setError(message); Toast.show({ type: "error", text1: message }); } }
    finally { working.current = false; if (alive.current) { setBusy(false); setStatus(""); setHandoff(false); } }
  }
  return <Screen style={styles.screen}><ScreenBar style={styles.header}><BackChip onPress={onBack} /><Text style={styles.title}>改一改</Text></ScreenBar>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.name}>{manifest.title}</Text><Text style={styles.caption}>体验版本 {manifest.releaseId.slice(0, 12)} · {manifest.appId}</Text>
      <TextInput accessibilityLabel="应用修改反馈" editable={ready && !busy} multiline maxLength={2000} value={body} onChangeText={setBody} placeholder="哪里不合适？你希望改成什么样？也可以补充复现步骤。" placeholderTextColor={colors.ink3} style={styles.input} />
      <Text style={styles.caption}>{body.length}/2000 · 截图最多三张</Text>
      <View style={styles.images}>{photos.map((photo, index) => <View key={photo.path || photo.url} style={styles.photo}><FastImage source={{ uri: photo.url || (photo.path?.startsWith("/") ? `file://${photo.path}` : photo.path) }} resizeMode={FastImage.resizeMode.contain} style={styles.image} /><Pressy disabled={busy} accessibilityLabel={`移除截图 ${index + 1}`} onPress={() => setPhotos(previous => previous.filter((_, i) => i !== index))}><Text style={styles.link}>移除</Text></Pressy></View>)}</View>
      <Pressy disabled={busy || !ready || photos.length >= 3} onPress={() => void choose()}><Text style={styles.link}>＋ 添加截图</Text></Pressy>
      <Text style={styles.caption}>截图会上传并交给制作服务，请先移除敏感信息。自己的作品继续原会话；别人的应用基于当前公开版本创作一份新作品。</Text>
      <Text style={styles.caption}>带回工坊后可以预览、修改，再确认开始制作。这一步不会启动制作任务。</Text>
      {busy ? <View style={styles.progress}><ActivityIndicator color={colors.accent} /><Text accessibilityLiveRegion="polite" style={styles.caption}>{status}</Text></View> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <Pressy disabled={busy || !ready || !body.trim()} onPress={() => void prepare()} style={[styles.submit, (busy || !body.trim()) && { opacity: 0.4 }]}><Text style={{ color: colors.canvas, fontWeight: "600" }}>带回工坊</Text></Pressy>
    </ScrollView></Screen>;
}
const styles = themedStyleSheet(t => ({ screen: { flex: 1, backgroundColor: t.canvas }, header: { padding: 20, flexDirection: "row", alignItems: "center", gap: 16 }, title: { color: t.ink1, fontSize: 23 }, content: { padding: 20, paddingBottom: 40, gap: 16 }, name: { color: t.ink1, fontSize: 19, fontWeight: "600" }, caption: { color: t.ink3, fontSize: 13, lineHeight: 20 }, input: { minHeight: 160, padding: 16, color: t.ink1, backgroundColor: t.field, borderRadius: 16, textAlignVertical: "top" as const }, images: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, photo: { width: 96 }, image: { width: 96, height: 140, backgroundColor: t.field, borderRadius: 10 }, link: { color: t.accentText, paddingVertical: 10 }, submit: { padding: 16, backgroundColor: t.accent, alignItems: "center", borderRadius: 16 }, progress: { flexDirection: "row", alignItems: "center", gap: 10 }, error: { color: t.orangeText, lineHeight: 20 } }));
