import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import FastImage from "@d11/react-native-fast-image";
import ImagePicker from "react-native-image-crop-picker";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { usePreventRemove } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { PageHeader } from "../../../../../packages/ui/chrome";
import { Screen } from "../../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../../packages/ui/theme";
import { cachedAccountId, currentAccountId, uploadPostImage, useAccount } from "../account";
import { readShellValue, writeShellValue } from "../shellStorage";
import { publishUserPost } from "./userPosts";
import { fetchMarket, type MarketApplication } from "../market";
import { ApplicationPostCard } from "./ApplicationPostCard";

type Photo = { path: string; id?: string; url?: string };
export function ComposePostScreen({ onBack, initialApplication }: { onBack: () => void; initialApplication?: MarketApplication }) {
  const { colors } = useTheme(); const { user } = useAccount(); const owner = useRef(cachedAccountId()).current;
  const [text, setText] = useState(initialApplication ? `我发布了《${initialApplication.title || initialApplication.manifest.title}》，欢迎来体验。` : ""); const [photos, setPhotos] = useState<Photo[]>([]); const [busy, setBusy] = useState(false); const [choosing, setChoosing] = useState(false); const [status, setStatus] = useState("");
  const [application, setApplication] = useState<MarketApplication | undefined>(initialApplication);
  const [picking, setPicking] = useState(false); const [loadingApps, setLoadingApps] = useState(false); const [appsError, setAppsError] = useState(""); const [applications, setApplications] = useState<MarketApplication[]>([]);
  const [published, setPublished] = useState(false);
  const working = useRef(false); const alive = useRef(true); const files = useRef(new Set<string>()); const revision = useRef(0); const request = useRef<{ signature: string; id: string } | undefined>(undefined);
  const count = Array.from(text).length; const canPublish = (text.trim().length > 0 || photos.length > 0 || !!application) && count <= 2000 && !busy && !choosing && !picking;
  usePreventRemove(busy, () => Toast.show({ type: "info", text1: "正在发布，请稍候" }));
  useEffect(() => { if (published && !busy) onBack(); }, [published, busy, onBack]);
  useEffect(() => {
    if (owner && !initialApplication) void readShellValue(`social.application-draft.${owner}`).then(value => { if (alive.current && !revision.current && value) { try { const draft = JSON.parse(value); setText(typeof draft.body === "string" ? draft.body : ""); setApplication(draft.application?.authorId === owner ? draft.application : undefined); } catch {} } });
    return () => { alive.current = false; for (const path of files.current) void ImagePicker.cleanSingle(path).catch(() => {}); };
  }, [owner]);
  function saveDraft(body: string, selected?: MarketApplication) { revision.current++; if (owner) writeShellValue(`social.application-draft.${owner}`, JSON.stringify({ body, application: selected })); }
  function change(value: string) { setText(value); saveDraft(value, application); }
  function selectApplication(item?: MarketApplication) { setApplication(item); setPicking(false); saveDraft(text, item); }
  async function pickApplication() {
    if (working.current || loadingApps) return;
    Keyboard.dismiss(); setPicking(true); setLoadingApps(true); setAppsError("");
    try { const items = await fetchMarket(); if (await currentAccountId() !== owner) throw new Error("账号已改变，请重试"); if (alive.current) setApplications(items.filter(item => item.authorId === owner)); }
    catch (error) { if (alive.current) setAppsError(error instanceof Error ? error.message : "应用列表暂时不可用"); }
    finally { if (alive.current) setLoadingApps(false); }
  }
  async function choose() {
    if (working.current || photos.length >= 4) return;
    working.current = true; setChoosing(true);
    try {
      const images = await ImagePicker.openPicker({ mediaType: "photo", multiple: true, maxFiles: 4 - photos.length, forceJpg: true, compressImageMaxWidth: 1600, compressImageMaxHeight: 1600, compressImageQuality: 0.8 });
      if (!alive.current) { for (const image of images) void ImagePicker.cleanSingle(image.path).catch(() => {}); return; }
      const valid: Photo[] = [];
      for (const image of images) { files.current.add(image.path); if (!image.size || image.size > 3 * 1024 * 1024) throw new Error("图片压缩后仍过大，请选择较小的照片"); valid.push({ path: image.path }); }
      if (alive.current) setPhotos(previous => [...previous, ...valid].slice(0, 4));
    } catch (error) { if ((error as { code?: string }).code !== "E_PICKER_CANCELLED") Toast.show({ type: "error", text1: "选择图片失败", text2: error instanceof Error ? error.message : "请检查相册权限后重试" }); }
    finally { working.current = false; if (alive.current) setChoosing(false); }
  }
  function remove(index: number) { const photo = photos[index]; setPhotos(previous => previous.filter((_, i) => i !== index)); files.current.delete(photo.path); void ImagePicker.cleanSingle(photo.path).catch(() => {}); }
  async function publish() {
    if (working.current || !canPublish) return;
    working.current = true; setBusy(true);
    try {
      if (!owner || await currentAccountId() !== owner) throw new Error("请登录原账号后再发布");
      const attached = application ? { appId: application.manifest.appId, releaseId: application.manifest.releaseId } : undefined;
      const signature = JSON.stringify({ body: text.trim(), paths: photos.map(photo => photo.path), application: attached });
      if (request.current?.signature !== signature) request.current = { signature, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}` };
      const uploaded = [...photos];
      for (let index = 0; index < uploaded.length; index++) {
        if (uploaded[index].id) continue;
        setStatus(`正在上传图片 ${index + 1}/${uploaded.length}…`);
        const image = await uploadPostImage(uploaded[index].path);
        if (await currentAccountId() !== owner) throw new Error("账号已改变，请重试");
        uploaded[index] = { ...uploaded[index], ...image }; if (alive.current) setPhotos([...uploaded]);
      }
      setStatus("正在发布…"); await publishUserPost(text.trim(), uploaded.map(photo => photo.id!), request.current!.id, attached);
      writeShellValue(`social.application-draft.${owner}`, "");
      if (alive.current) { setBusy(false); setStatus(""); setPublished(true); Toast.show({ type: "success", text1: "动态已发布" }); }
    } catch (error) { if (alive.current) Toast.show({ type: "error", text1: "发布未完成", text2: error instanceof Error ? error.message : "内容已保留，可以重试" }); }
    finally { working.current = false; if (alive.current) { setBusy(false); setStatus(""); } }
  }
  return <Screen style={styles.screen}>
    <PageHeader title="发动态" onBack={busy ? undefined : onBack} right={<Pressable accessibilityLabel="发布动态" accessibilityState={{ disabled: !canPublish }} disabled={!canPublish} onPress={() => void publish()} style={[styles.publish, !canPublish && styles.disabled]}>{busy ? <ActivityIndicator size="small" color={colors.canvas} /> : <Text style={styles.publishText}>发布</Text>}</Pressable>} />
    <KeyboardAvoidingView style={styles.fill} behavior="padding">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.author}>{user?.avatarUrl ? <FastImage source={{ uri: user.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.placeholder]}><Text style={styles.initial}>{Array.from(user?.name || "我")[0]}</Text></View>}<Text style={styles.name}>{user?.name || "我"}</Text></View>
        <TextInput accessibilityLabel="动态内容" multiline editable={!busy} value={text} onChangeText={change} maxLength={4000} placeholder="分享此刻的想法…" placeholderTextColor={colors.ink3} style={styles.input} textAlignVertical="top" />
        <View style={styles.photos}>{photos.map((photo, index) => <View key={photo.path} style={styles.photo}><FastImage source={{ uri: photo.path.startsWith("file:") ? photo.path : `file://${photo.path}` }} style={styles.image} />{!busy ? <Pressable accessibilityLabel={`移除第 ${index + 1} 张图片`} onPress={() => remove(index)} style={styles.remove}><Text style={styles.removeText}>×</Text></Pressable> : null}</View>)}</View>
        <View style={styles.tools}><Pressable accessibilityLabel="添加图片，最多四张" disabled={busy || choosing || photos.length >= 4} onPress={() => void choose()} style={styles.add}><Text style={styles.addText}>{choosing ? "正在处理图片…" : `添加图片 ${photos.length}/4`}</Text></Pressable><Text style={[styles.counter, count > 2000 && { color: colors.danger }]}>{count}/2000</Text></View>
        <Pressable accessibilityLabel="选择自己已上架的应用" disabled={busy || choosing} onPress={() => void pickApplication()} style={styles.add}><Text style={styles.addText}>{application ? "更换附带应用" : "附带我的应用"}</Text></Pressable>
        {application ? <View><ApplicationPostCard preview application={{ ...application.manifest, title: application.title || application.manifest.title, summary: application.summary ?? application.manifest.summary }} /><Pressable disabled={busy} onPress={() => selectApplication()} style={styles.add}><Text style={styles.counter}>移除应用</Text></Pressable></View> : null}
        {busy ? <View style={styles.status}><ActivityIndicator size="small" color={colors.accent} /><Text style={styles.counter}>{status || "准备发布…"}</Text></View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}><View style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}><Pressable accessibilityLabel="关闭应用选择" onPress={() => setPicking(false)} style={{ flex: 1 }} /><View style={{ backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, maxHeight: "75%", gap: 12 }}><Text style={{ color: colors.ink1, fontWeight: "700", fontSize: 18 }}>我的已上架应用</Text><Text style={styles.counter}>仅分享应用市场里的公开版本</Text><ScrollView keyboardShouldPersistTaps="handled">{loadingApps ? <ActivityIndicator color={colors.accent} style={{ padding: 24 }} /> : appsError ? <Pressable onPress={() => void pickApplication()} style={styles.add}><Text style={{ color: colors.danger }}>{appsError} · 重试</Text></Pressable> : applications.length ? applications.map(item => <Pressable key={item.manifest.appId} accessibilityLabel={`选择${item.title || item.manifest.title}`} onPress={() => selectApplication(item)} style={{ paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: colors.line }}><Text style={styles.name}>{item.title || item.manifest.title}</Text><Text numberOfLines={2} style={styles.counter}>{item.summary || item.manifest.summary}</Text></Pressable>) : <Text style={{ color: colors.ink3, paddingVertical: 24 }}>还没有已上架应用。先在作品详情中发布到市场，就可以分享了。</Text>}</ScrollView><Pressable onPress={() => setPicking(false)} style={styles.add}><Text style={[styles.addText, { textAlign: "center" }]}>取消</Text></Pressable></View></View></Modal>
  </Screen>;
}
const styles = themedStyleSheet(t => ({
  screen: { flex: 1, backgroundColor: t.canvas }, fill: { flex: 1 }, content: { padding: 24, gap: 18, paddingBottom: 40 }, author: { flexDirection: "row", gap: 12, alignItems: "center" }, avatar: { width: 42, height: 42, borderRadius: 21 }, placeholder: { alignItems: "center", justifyContent: "center", backgroundColor: t.accentTint }, initial: { color: t.accent, fontSize: 20 }, name: { color: t.ink1, fontSize: 16, fontWeight: "600" }, input: { minHeight: 180, color: t.ink1, fontSize: 18, lineHeight: 28, padding: 0 }, photos: { flexDirection: "row", gap: 8, flexWrap: "wrap" }, photo: { width: "48%", aspectRatio: 1, borderRadius: 14, overflow: "hidden", backgroundColor: t.surface }, image: { width: "100%", height: "100%" }, remove: { position: "absolute", right: 6, top: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: "#00000099", alignItems: "center", justifyContent: "center" }, removeText: { color: "#FFFFFF", fontSize: 22 }, tools: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, add: { paddingVertical: 12 }, addText: { color: t.accentText, fontSize: 15 }, counter: { color: t.ink3, fontSize: 12 }, publish: { backgroundColor: t.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, minWidth: 68, alignItems: "center" }, publishText: { color: t.canvas, fontWeight: "600", fontSize: 14 }, disabled: { opacity: 0.4 }, status: { flexDirection: "row", gap: 10, alignItems: "center" },
}));
