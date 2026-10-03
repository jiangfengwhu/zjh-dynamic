import { currentAccountId, requireAccount, useAccount, uploadMarketScreenshot } from "./account";
import { openApplicationWorkshop } from "./workshopNavigation";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Text, View } from "react-native";
import { KeyboardAwareScrollView as ScrollView, type KeyboardAwareScrollViewRef } from "react-native-keyboard-controller";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import { MediaPicker as ImagePicker } from "../../../../packages/ui/media/MediaPicker";
import { AppImage } from "../../../../packages/ui/media/AppImage";
import Toast from "react-native-toast-message";
import { FormField as TextInput } from "./FormField";
import { PageHeader, Pressy, Surface } from "../../../../packages/ui/chrome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { EdgeModal, Screen } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { loadCatalog, subscribeCatalog } from "./catalog";
import { readShellValue, writeShellValue, removeShellValue } from "./shellStorage";
import { offerApplication, applyApplicationUpdate, runningApplication, runningApplicationReleases, type ApplicationManifest } from "../runtime/applications";

import { cachedSharing, loadSharing, editMarketApplication, withdrawMarketApplication, shareMarketApplication, installMarketApplication, uninstallMarketApplication, marketCategories, marketDefinition, type MarketApplication, type SharingState } from "./market";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
export function MarketDetailScreen({ item, publish, onBack, onOpen, onModify, onSharePost, onAuthor }: { onModify: (manifest: ApplicationManifest, ownerId: string) => void; onAuthor: (author: { id: string; name: string; avatarUrl: string | null; official?: boolean }) => void; publish?: boolean; item: MarketApplication; onBack: () => void; onOpen: (id: string) => void; onSharePost: (item: MarketApplication) => void }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { user } = useAccount();
  const { colors } = useTheme(); const app = item.manifest; const focused = useIsFocused();
  const [installed, setInstalled] = useState(false); const [release, setRelease] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [owner, setOwner] = useState(false); const [sharing, setSharing] = useState<SharingState>();
  const [sharingReady, setSharingReady] = useState(false); const [shareNotice, setShareNotice] = useState("");
  const [sharingAttempt, setSharingAttempt] = useState(0);
  const [draftOwner, setDraftOwner] = useState<string>();
  const draftKey = `market.edit-draft.${draftOwner}.${app.appId}`;
  const [editMode, setEditMode] = useState<"edit" | "share" | null>(null);
  const [selectedRelease, setSelectedRelease] = useState("");
  const [shareTitle, setShareTitle] = useState(item.title || app.title); const [shareSummary, setShareSummary] = useState(item.summary || app.summary);
  const [shareCategory, setShareCategory] = useState(item.category || "other"); const [screenshots, setScreenshots] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState(""); const [preview, setPreview] = useState<string>();
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  usePreventRemove(busy, () => Toast.show({ type: "info", text1: "正在处理，请稍候" }));
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const mutation = useRef(false);
  const publicationOpened = useRef(false);
  async function modify() {
    if (mutation.current) return;
    mutation.current = true; setBusy(true);
    try {
      if (!await requireAccount()) return;
      const ownerId = await currentAccountId();
      if (!ownerId) return;
      const manifest = (installed ? runningApplication(app.appId) : undefined) ?? (owner ? sharing?.application : undefined) ?? app;
      onModify(manifest, ownerId);
    } catch (e) { Toast.show({ type: "error", text1: e instanceof Error ? e.message : "无法打开反馈页" }); }
    finally { mutation.current = false; if (alive.current) setBusy(false); }
  }
  useEffect(() => {
    if (publish && sharingReady && sharing?.application && !publicationOpened.current) { publicationOpened.current = true; begin("share"); }
  }, [publish, sharingReady, sharing]);
  useEffect(() => {
    let live = true;
    const update = async (entries: Awaited<ReturnType<typeof loadCatalog>>) => {
      const raw = await readShellValue(`application.pending.${app.appId}`) || await readShellValue(`application.install.${app.appId}`);
      if (!live) return;
      setInstalled(entries.some(entry => entry.id === app.appId && !entry.trashedAt && !entry.purged));
      try { setRelease(raw ? JSON.parse(raw).releaseId : ""); } catch { setRelease(""); }
    };
    void loadCatalog().then(update); const off = subscribeCatalog(entries => { void update(entries); });
    return () => { live = false; off(); };
  }, [app.appId]);
  useEffect(() => {
    if (!focused) return;
    let live = true;
    async function refresh() {
      setSharingReady(false);
      const accountId = await currentAccountId();
      const owned = Boolean(accountId) && await readShellValue(`shell.jules.apps.${app.appId}.owner`) === accountId;
      if (!live) return; setOwner(owned);
      if (!owned) { setSharing(undefined); setEditMode(null); return; }
      const cached = await cachedSharing(app.appId); if (live && cached) setSharing(cached);
      try { const state = await loadSharing(app.appId); if (live) { setSharing(state); setSharingReady(true); setShareNotice(""); } }
      catch { if (live) setShareNotice("分享状态暂未接回，请稍后重新打开详情。"); }
    }
    void refresh(); return () => { live = false; };
  }, [app.appId, focused, user?.id, sharingAttempt]);
  useEffect(() => { if (editMode && draftOwner === user?.id) writeShellValue(draftKey, JSON.stringify({ mode: editMode, releaseId: selectedRelease, title: shareTitle, summary: shareSummary, category: shareCategory, screenshots })); }, [editMode, draftOwner, user?.id, selectedRelease, shareTitle, shareSummary, shareCategory, screenshots]);
  async function begin(mode: "edit" | "share") {
    const ownerId = user?.id;
    if (!ownerId) return;
    setDraftOwner(ownerId);
    setShareTitle(sharing?.shared?.title || sharing?.application?.title || item.title || app.title);
    setShareSummary(sharing?.shared?.summary ?? sharing?.application?.summary ?? item.summary ?? app.summary);
    setSelectedRelease(sharing?.application?.releaseId || "");
    setShareCategory(sharing?.shared?.category || item.category || "other");
    setScreenshots(sharing?.shared?.screenshots || item.screenshots || []);
    setShareNotice("");
    try {
      const cached = JSON.parse(await readShellValue(`market.edit-draft.${ownerId}.${app.appId}`) || "null");
      if (!alive.current || await currentAccountId() !== ownerId) return;
      if (cached?.mode === mode && (mode === "edit" || cached.releaseId === sharing?.application?.releaseId)) {
        if (typeof cached.title === "string") setShareTitle(cached.title);
        if (typeof cached.summary === "string") setShareSummary(cached.summary);
        if (marketCategories.some(item => item.id === cached.category)) setShareCategory(cached.category);
        if (Array.isArray(cached.screenshots)) setScreenshots(cached.screenshots.filter((url: unknown) => typeof url === "string" && url.startsWith("https://")).slice(0, 6));
      }
    } catch { /* Use the current published fields when a draft is invalid. */ }
    if (alive.current && await currentAccountId() === ownerId) setEditMode(mode);
  }
  async function chooseScreenshots() {
    if (mutation.current || screenshots.length >= 6) return;
    const accountId = await currentAccountId(); if (!accountId) return;
    mutation.current = true; setBusy(true); setError(""); setUploadStatus("正在选择截图…");
    let paths: string[] = [];
    try {
      const images = await ImagePicker.openPicker({ mediaType: "photo", multiple: true, maxFiles: 6 - screenshots.length, forceJpg: true, compressImageMaxWidth: 1600, compressImageMaxHeight: 2400, compressImageQuality: 0.75 });
      paths = images.map(image => image.path);
      if (images.length > 6 - screenshots.length) throw new Error("截图最多六张，请减少选择数量");
      for (let index = 0; index < images.length; index++) {
        if (images[index].size > 2 * 1024 * 1024) throw new Error("截图压缩后仍超过 2 MB，请选择较小的图片");
        if (!alive.current || await currentAccountId() !== accountId) throw new Error("账号已改变，请重试");
        setUploadStatus(`正在上传截图 ${index + 1}/${images.length}…`);
        const url = await uploadMarketScreenshot(app.appId, images[index].path);
        if (alive.current && await currentAccountId() === accountId) setScreenshots(previous => [...new Set([...previous, url])].slice(0, 6));
      }
    } catch (e) {
      if ((e as { code?: string }).code !== "E_PICKER_CANCELLED" && alive.current) { const message = e instanceof Error ? e.message : "截图上传失败，请重试"; setError(message); Toast.show({ type: "error", text1: message }); }
    } finally {
      for (const path of paths) void ImagePicker.cleanSingle(path).catch(() => {});
      mutation.current = false; if (alive.current) { setBusy(false); setUploadStatus(""); }
    }
  }
  async function save() {
    if (mutation.current || !sharingReady || !editMode) return;
    mutation.current = true; setBusy(true); setError("");
    try {
      const state = editMode === "edit" ? await editMarketApplication(app.appId, shareTitle, shareSummary, shareCategory, screenshots) : await shareMarketApplication(app.appId, selectedRelease, shareTitle, shareSummary, shareCategory, screenshots);
      removeShellValue(draftKey); setSharing(state); setEditMode(null); setShareNotice(editMode === "edit" ? "分享信息已保存，公开版本保持不变。" : "已将选定版本分享到应用市场。");
      if (editMode === "share" && state.shared) { const published = state.shared; Alert.alert("应用已上架", "发一条动态，介绍你的作品？", [{ text: "稍后" }, { text: "发动态", onPress: () => onSharePost(published) }]); }
    } catch (e) { const message = e instanceof Error ? e.message : "分享未完成，请重试"; setError(message); Toast.show({ type: "error", text1: message }); }
    finally { mutation.current = false; setBusy(false); }
  }
  function withdraw() {
      if (mutation.current) return; mutation.current = true; setBusy(true); setError("");
      void withdrawMarketApplication(app.appId).then(state => { setSharing(state); setEditMode(null); setShareNotice("已撤回分享，作品仍保留在我的作品中。"); }).catch(e => setError(e instanceof Error ? e.message : "撤回未完成")).finally(() => { mutation.current = false; setBusy(false); });
  }
  const targetRelease = owner ? sharing?.application?.releaseId ?? app.releaseId : app.releaseId;
  const update = installed && (owner || item.latest) && release && release !== targetRelease;
  async function install() {
    if (mutation.current) return; mutation.current = true; setBusy(true); setError("");
    try {
      if (owner && user) {
        offerApplication(sharing?.application ?? app, user.id);
        await applyApplicationUpdate(app.appId);
      } else { await installMarketApplication(item); setInstalled(true); setRelease(app.releaseId); onOpen(app.appId); }
    }
    catch (e) { setError(e instanceof Error ? e.message : "安装没有完成，请重试"); }
    finally { mutation.current = false; setBusy(false); }
  }
  function uninstall() {
    Alert.alert("卸载应用？", "会从这台手机的应用列表移除，保留本机数据与缓存。重新安装可继续使用。", [{ text: "取消", style: "cancel" }, { text: "卸载", style: "destructive", onPress: () => { if (mutation.current) return; mutation.current = true; setBusy(true); void uninstallMarketApplication(app.appId).then(() => { if (alive.current) { setInstalled(false); setRelease(""); } }).catch(e => { if (alive.current) setError(e instanceof Error ? e.message : "卸载未完成，请重试"); }).finally(() => { mutation.current = false; if (alive.current) setBusy(false); }); } }]);
  }
  const Avatar = marketDefinition(item)?.avatar; const bytes = app.bundle.bytes + app.assets.reduce((total, asset) => total + asset.bytes, 0);
  const shared = sharing?.shared; const hasNewVersion = Boolean(shared && sharing?.application && shared.manifest.releaseId !== sharing.application.releaseId);
  const gallery = shared?.screenshots || item.screenshots || [];
  const authorName = owner && user ? user.name : item.authorName;
  const authorAvatar = owner && user ? user.avatarUrl : item.authorAvatarUrl;
  const authorId = owner && user ? user.id : item.authorId;
  function visitAuthor() { if (authorId) onAuthor({ id: authorId, name: authorName || "社区创作者", avatarUrl: authorAvatar ?? null, official: sharing?.shared?.authorOfficial ?? item.authorOfficial }); }
  const versionName = (manifest: MarketApplication["manifest"]) => `${manifest.version || "1.0.0"}`;
  if (item.owned && item.authorId !== user?.id) return <Screen style={styles.screen}><PageHeader title="作品详情" onBack={onBack} /><Text style={[styles.copy, { padding: 16 }]}>请登录作品所属账号后查看。</Text></Screen>;
  return <Screen style={styles.screen}><PageHeader title={owner ? "作品详情" : "应用详情"} onBack={onBack} /><ScrollView ref={scroll} contentContainerStyle={styles.content}>
    <View style={styles.hero}><View style={[styles.mark, { backgroundColor: `${app.accent}18` }]}>{Avatar ? <Avatar size={52} animated /> : <Text style={{ fontSize: 24, color: app.accent }}>{app.mark}</Text>}</View><View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={styles.title}>{shared?.title || item.title || app.title}</Text><Pressy disabled={!authorId} accessibilityLabel="查看作者主页" onPress={visitAuthor} style={{ minHeight: 32, flexDirection: "row", alignItems: "center", gap: 6 }}>{authorAvatar ? <Image source={{ uri: authorAvatar }} style={{ width: 20, height: 20, borderRadius: 10 }} /> : null}<Text style={[styles.caption, { color: colors.accentText }]}>{authorName || "社区创作者"}</Text>{(sharing?.shared?.authorOfficial ?? item.authorOfficial) ? <Text accessibilityLabel="官方发布" style={styles.official}>官方</Text> : null}</Pressy></View></View>
    <View style={styles.description}><Text style={styles.subtitle}>它能帮你做什么</Text><Text style={styles.copy}>{shared?.summary ?? item.summary ?? app.summary ?? "打开应用，看看它能带来什么。"}</Text></View>
    <Text style={styles.caption}>{marketCategories.find(category => category.id === (shared?.category || item.category || "other"))?.label}</Text>
    {gallery.length ? <View style={{ gap: 12 }}><Text style={styles.subtitle}>应用截图</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>{gallery.map((url, index) => <Pressy key={url} accessibilityLabel={`查看截图 ${index + 1}`} onPress={() => setPreview(url)}><AppImage source={{ uri: url }} style={{ width: 144, height: 240, borderRadius: colors.radius.sm, backgroundColor: colors.inset }} resizeMode={"contain"} /></Pressy>)}</ScrollView></View> : null}
    <View style={styles.facts}><Text style={styles.caption}>版本 {app.version || "1.0.0"}</Text><Text style={styles.caption}>安装包 {bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`}</Text><Text style={styles.caption}>数据保存在本机</Text></View>
    {item.originalAppId ? <Text style={styles.caption}>基于其他作品创作</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <View style={styles.tools}>{installed && update ? <Pressy disabled={busy} onPress={() => onOpen(app.appId)}><Text style={styles.secondary}>先打开已安装版本</Text></Pressy> : null}
    {app.appId !== bootstrap.defaultApplication ? <Pressy accessibilityRole="button" accessibilityLabel="改一改这个应用" disabled={busy} onPress={() => void modify()}><Text style={styles.secondary}>改一改</Text></Pressy> : null}
    <Pressy accessibilityRole="button" disabled={busy} onPress={() => { void requireAccount().then(allowed => { if (allowed) void openApplicationWorkshop(app.appId, app.title, !owner, !owner, app.releaseId).catch(e => setError(String(e))); }); }}><Text style={styles.secondary}>{owner ? "继续修改这个作品" : "基于它创作"}</Text></Pressy></View>
    {owner ? <Surface radius={colors.radius.md} style={styles.management}><Text style={styles.subtitle}>管理分享</Text>
      <Text style={styles.copy}>{shared ? hasNewVersion ? "已分享 · 有新版本待分享" : "已分享到应用市场" : "尚未分享"}</Text>
      {shared ? <><Text style={styles.copy}>分享名称：{shared.title || shared.manifest.title}</Text><Text style={styles.caption}>{shared.summary ?? shared.manifest.summary}</Text></> : null}
      {shared ? <><Text style={styles.caption}>当前公开版本 {versionName(shared.manifest)}</Text><Pressy disabled={busy || !sharingReady} onPress={() => onSharePost(shared)}><Text style={styles.secondary}>发动态介绍这个应用</Text></Pressy></> : null}
      {sharing?.application ? <Text style={styles.caption}>最新制作版本 {versionName(sharing.application)}</Text> : <Text style={styles.caption}>完成发包后，就可以上架。</Text>}
      {shareNotice ? <View style={{ gap: 8 }}><Text style={styles.caption}>{shareNotice}</Text>{!sharingReady ? <Pressy accessibilityRole="button" disabled={busy} onPress={() => setSharingAttempt(value => value + 1)}><Text style={styles.secondary}>重试读取分享状态</Text></Pressy> : null}</View> : null}
      {sharing?.application && (!shared || hasNewVersion) ? <Pressy disabled={busy || !sharingReady} onPress={() => begin("share")}><Text style={styles.secondary}>{shared ? hasNewVersion ? "将新版本分享到市场" : "重新分享最新制作版本" : "分享最新制作版本"}</Text></Pressy> : null}
      {shared ? <><Pressy disabled={busy || !sharingReady} onPress={() => begin("edit")}><Text style={styles.secondary}>编辑市场信息与截图</Text></Pressy><Pressy disabled={busy || !sharingReady} onPress={withdraw}><Text style={styles.secondary}>撤回分享</Text></Pressy></> : null}
      {editMode ? <View style={{ gap: 12 }} onLayout={() => { if (publish) scroll.current?.scrollToEnd({ animated: true }); }}><Text style={styles.subtitle}>{editMode === "edit" ? "编辑分享信息" : "分享作品"}</Text><TextInput accessibilityLabel="分享名称" editable={!busy} value={shareTitle} onChangeText={setShareTitle} maxLength={60} style={{ color: colors.ink1, backgroundColor: colors.field, padding: 12, borderRadius: 12 }} /><TextInput accessibilityLabel="分享介绍" editable={!busy} value={shareSummary} onChangeText={setShareSummary} multiline maxLength={300} style={{ color: colors.ink1, backgroundColor: colors.field, padding: 12, borderRadius: 12 }} /><Text style={styles.subtitle}>应用分类</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{marketCategories.filter(category => category.id).map(category => <Pressy key={category.id} disabled={busy} accessibilityRole="button" accessibilityState={{ selected: shareCategory === category.id }} onPress={() => setShareCategory(category.id)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: shareCategory === category.id ? colors.accentTint : colors.inset }}><Text style={{ color: shareCategory === category.id ? colors.accentText : colors.ink3 }}>{category.label}</Text></Pressy>)}</View>
<Text style={styles.subtitle}>截图 {screenshots.length}/6</Text><Text style={styles.caption}>选择真实应用截图，第一张作为市场预览图。可选，压缩为 JPEG 后保存。</Text>
<View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>{screenshots.map((url, index) => <View key={url} style={{ gap: 6 }}><Pressy onPress={() => setPreview(url)} accessibilityLabel={`预览截图 ${index + 1}`}><AppImage source={{ uri: url }} style={{ width: 88, height: 140, borderRadius: 10, backgroundColor: colors.inset }} resizeMode={"contain"} /></Pressy><Pressy disabled={busy} onPress={() => setScreenshots(previous => previous.filter(value => value !== url))} accessibilityLabel={`移除截图 ${index + 1}`}><Text style={styles.secondary}>移除</Text></Pressy></View>)}</View>
{screenshots.length < 6 ? <Pressy disabled={busy} onPress={() => void chooseScreenshots()}><Text style={styles.secondary}>添加截图</Text></Pressy> : null}
{uploadStatus ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><ActivityIndicator color={colors.accent} /><Text accessibilityLiveRegion="polite" style={styles.caption}>{uploadStatus}</Text></View> : null}
<Text style={styles.caption}>{editMode === "edit" ? "只修改展示信息，保留当前公开版本。" : `发布版本 ${selectedRelease.slice(0, 8)} · ${runningApplicationReleases()[app.appId] === selectedRelease ? "正在体验此版本" : "此版本尚未体验"}。之后制作的版本不会自动公开。`}</Text><Pressy disabled={busy || !sharingReady || !shareTitle.trim()} onPress={() => void save()}><Text style={styles.secondary}>{editMode === "edit" ? "保存分享信息" : "发布到市场"}</Text></Pressy><Pressy disabled={busy} onPress={() => { removeShellValue(draftKey); setEditMode(null); }}><Text style={styles.secondary}>取消</Text></Pressy></View> : null}
    </Surface> : null}
    {installed && app.appId !== bootstrap.defaultApplication ? <Pressy disabled={busy} onPress={uninstall}><Text style={[styles.secondary, { color: colors.redText }]}>卸载应用</Text></Pressy> : null}
    {app.appId === bootstrap.defaultApplication ? <Text style={styles.caption}>Jolly 是默认伙伴，工坊就在它的主页里。</Text> : null}
  </ScrollView><View style={styles.dock}><Pressy accessibilityRole="button" disabled={busy} onPress={() => installed && !update ? onOpen(app.appId) : void install()} style={styles.primary}>{busy ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryText}>{installed ? update ? "更新并体验" : "打开应用" : owner ? "加载并体验" : "安装体验"}</Text>}</Pressy></View><EdgeModal visible={!!preview} transparent animationType={reduceMotion ? "none" : "fade"} onRequestClose={() => setPreview(undefined)}><View style={{ flex: 1, backgroundColor: "#141517", paddingTop: 12 + insets.top, paddingBottom: 12 + insets.bottom }}><Pressy accessibilityLabel="关闭截图" onPress={() => setPreview(undefined)} style={{ padding: 16 }}><Text style={{ color: "#fff", textAlign: "right", fontSize: 16 }}>关闭</Text></Pressy>{preview ? <AppImage source={{ uri: preview }} style={{ flex: 1 }} resizeMode={"contain"} /> : null}</View></EdgeModal></Screen>;
}
const styles = themedStyleSheet(t => ({
  screen: { flex: 1, backgroundColor: t.canvas },
  bar: { paddingHorizontal: 12, paddingVertical: 2, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 0.5, borderBottomColor: t.line },
  barTitle: { fontSize: 19, color: t.ink1, fontWeight: "600" },
  content: { padding: 16, gap: 12, paddingBottom: 16 },
  hero: { flexDirection: "row", alignItems: "center", gap: 12 },
  mark: { width: 52, height: 52, borderRadius: t.radius.md, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  title: { fontSize: 23, lineHeight: 30, letterSpacing: -0.5, color: t.ink1, fontWeight: "800" },
  official: { color: t.accentText, backgroundColor: t.accentTint, fontSize: 10, fontWeight: "600", borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2, overflow: "hidden" },
  caption: { fontSize: 12, color: t.ink3, lineHeight: 18 },
  description: { paddingVertical: 4, gap: 6 }, management: { padding: 12, gap: 8 }, tools: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subtitle: { color: t.ink1, fontSize: 15, fontWeight: "600" },
  copy: { color: t.ink2, fontSize: 14, lineHeight: 21 },
  facts: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingVertical: 10, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: t.line },
  primary: { minHeight: 48, backgroundColor: t.accent, borderRadius: 10, padding: 12, alignItems: "center", justifyContent: "center" },
  primaryText: { color: t.onAccent, fontSize: 15, fontWeight: "600" },
  secondary: { color: t.accentText, fontSize: 13, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: t.inset, borderRadius: t.radius.sm, overflow: "hidden" },
  error: { color: t.redText, lineHeight: 20 },
  dock: { paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: t.line, backgroundColor: t.canvas },
}));
