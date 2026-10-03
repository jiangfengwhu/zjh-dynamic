import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { KeyboardAwareScrollView as ScrollView } from "react-native-keyboard-controller";
import { retainDraftImage, removeDraftImage, existingDraftImages } from "./mediaDraft";
import { usePreventRemove } from "@react-navigation/native";
import { MediaPicker as ImagePicker } from "../../../../packages/ui/media/MediaPicker";
import { AppImage } from "../../../../packages/ui/media/AppImage";
import Toast from "react-native-toast-message";
import { FormField as TextInput } from "./FormField";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
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
  const delivered = useRef(false);
  usePreventRemove(busy && !handoff, () => Toast.show({ type: "info", text1: "正在处理反馈，请稍候" }));
  useEffect(() => {
    void readShellValue(key).then(async raw => {
      try {
        const cached = JSON.parse(raw || "null");
        const local = await existingDraftImages<Photo>(Array.isArray(cached?.photos) ? cached.photos : []);
        const remote = Array.isArray(cached?.images) ? cached.images.filter((url: unknown) => typeof url === "string" && url.startsWith("https://")).map((url: string) => ({ url })) : [];
        if (alive.current && await currentAccountId() === ownerId) { if (typeof cached?.body === "string") setBody(cached.body); setPhotos([...local, ...remote.filter((photo: Photo) => !local.some(item => item.url === photo.url))].slice(0, 3)); }
      } catch { if (alive.current) setError("草稿读取失败，请重新打开反馈页"); }
      if (alive.current && await currentAccountId() === ownerId) setReady(true);
    }).catch(() => { if (alive.current) setError("草稿读取失败，请重新打开反馈页"); });
    return () => { alive.current = false; for (const path of files.current) void ImagePicker.cleanSingle(path).catch(() => {}); };
  }, []);
  useEffect(() => { if (ready && !handoff && !delivered.current) writeShellValue(key, JSON.stringify({ body, photos, images: photos.filter(photo => !photo.path && photo.url).map(photo => photo.url) })); }, [body, photos, ready, handoff]);
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
      const retained: Photo[] = [];
      try {
        for (const image of images) retained.push({ path: await retainDraftImage(image.path) });
        if (!alive.current || await currentAccountId() !== ownerId) { for (const photo of retained) void removeDraftImage(photo.path); return; }
        setPhotos(previous => [...previous, ...retained]);
      } catch (cause) { for (const photo of retained) void removeDraftImage(photo.path); throw cause; }
      finally { for (const image of images) { files.current.delete(image.path); void ImagePicker.cleanSingle(image.path).catch(() => {}); } }
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
      delivered.current = true; removeShellValue(key);
      for (const photo of photos) void removeDraftImage(photo.path);
    } catch (e) { if (alive.current) { const message = e instanceof Error ? e.message : "反馈未能带回工坊，请重试"; setError(message); Toast.show({ type: "error", text1: message }); } }
    finally { working.current = false; if (alive.current) { setBusy(false); setStatus(""); setHandoff(false); } }
  }
  return <Screen style={styles.screen}><PageHeader title="改一改" caption="把体验中的想法带回工坊" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={styles.name}>{manifest.title}</Text><Text style={styles.caption}>体验版本 {manifest.releaseId.slice(0, 12)} · {manifest.appId}</Text>
      <TextInput accessibilityLabel="应用修改反馈" editable={ready && !busy} multiline maxLength={2000} value={body} onChangeText={setBody} placeholder="哪里不合适？你希望改成什么样？也可以补充复现步骤。" placeholderTextColor={colors.ink3} style={styles.input} />
      <Text style={styles.caption}>{body.length}/2000 · 截图最多三张</Text>
      <View style={styles.images}>{photos.map((photo, index) => <View key={photo.path || photo.url} style={styles.photo}><AppImage source={{ uri: photo.url || (photo.path?.startsWith("/") ? `file://${photo.path}` : photo.path) }} resizeMode={"contain"} style={styles.image} /><Pressy disabled={busy} accessibilityLabel={`移除截图 ${index + 1}`} onPress={() => { setPhotos(previous => previous.filter((_, i) => i !== index)); void removeDraftImage(photo.path); }}><Text style={styles.link}>移除</Text></Pressy></View>)}</View>
      <Pressy disabled={busy || !ready || photos.length >= 3} onPress={() => void choose()}><Text style={styles.link}>＋ 添加截图</Text></Pressy>
      <Text style={styles.caption}>截图会上传并交给制作服务，请先移除敏感信息。自己的作品继续原会话；别人的应用基于当前公开版本创作一份新作品。</Text>
      <Text style={styles.caption}>带回工坊后可以预览、修改，再确认开始制作。这一步不会启动制作任务。</Text>
      {busy ? <View style={styles.progress}><ActivityIndicator color={colors.accent} /><Text accessibilityLiveRegion="polite" style={styles.caption}>{status}</Text></View> : null}
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <Pressy disabled={busy || !ready || !body.trim()} onPress={() => void prepare()} style={[styles.submit, (busy || !body.trim()) && { opacity: 0.4 }]}><Text style={{ color: colors.onAccent, fontWeight: "600" }}>带回工坊</Text></Pressy>
    </ScrollView></Screen>;
}
const styles = themedStyleSheet(t => ({ screen: { flex: 1, backgroundColor: t.canvas }, header: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }, title: { color: t.ink1, fontSize: 23 }, content: { padding: 16, paddingBottom: 12, gap: 12 }, name: { color: t.ink1, fontSize: 19, fontWeight: "600" }, caption: { color: t.ink3, fontSize: 12, lineHeight: 18 }, input: { minHeight: 128, padding: 12, fontSize: 15, lineHeight: 22, color: t.ink1, backgroundColor: t.field, borderRadius: 16, textAlignVertical: "top" as const }, images: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, photo: { width: 88 }, image: { width: 88, height: 132, backgroundColor: t.field, borderRadius: 10 }, link: { color: t.accentText, paddingVertical: 10 }, submit: { minHeight: 44, padding: 12, backgroundColor: t.accent, alignItems: "center", borderRadius: 16 }, progress: { flexDirection: "row", alignItems: "center", gap: 10 }, error: { color: t.orangeText, lineHeight: 20 } }));
