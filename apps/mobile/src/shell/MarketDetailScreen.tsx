import { currentAccountId, requireAccount, useAccount } from "./account";
import { openApplicationWorkshop } from "./workshopNavigation";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, Text, TextInput, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { BackChip, Pressy, Surface } from "../../../../packages/ui/chrome";
import { Screen, ScreenBar } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { loadCatalog, subscribeCatalog } from "./catalog";
import { readShellValue } from "./shellStorage";
import { offerApplication, applyApplicationUpdate, runningApplicationReleases } from "../runtime/applications";

import { cachedSharing, loadSharing, editMarketApplication, withdrawMarketApplication, shareMarketApplication, installMarketApplication, uninstallMarketApplication, marketDefinition, type MarketApplication, type SharingState } from "./market";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
export function MarketDetailScreen({ item, publish, onBack, onOpen }: { publish?: boolean; item: MarketApplication; onBack: () => void; onOpen: (id: string) => void }) {
  const { user } = useAccount();
  const { colors } = useTheme(); const app = item.manifest; const focused = useIsFocused();
  const [installed, setInstalled] = useState(false); const [release, setRelease] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [owner, setOwner] = useState(false); const [sharing, setSharing] = useState<SharingState>();
  const [sharingReady, setSharingReady] = useState(false); const [shareNotice, setShareNotice] = useState("");
  const [editMode, setEditMode] = useState<"edit" | "share" | null>(null);
  const [selectedRelease, setSelectedRelease] = useState("");
  const [shareTitle, setShareTitle] = useState(item.title || app.title); const [shareSummary, setShareSummary] = useState(item.summary || app.summary);
  const scroll = useRef<ScrollView>(null);
  const mutation = useRef(false);
  const publicationOpened = useRef(false);
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
  }, [app.appId, focused, user?.id]);
  function begin(mode: "edit" | "share") {
    setShareTitle(sharing?.shared?.title || sharing?.application?.title || item.title || app.title);
    setShareSummary(sharing?.shared?.summary ?? sharing?.application?.summary ?? item.summary ?? app.summary);
    setSelectedRelease(sharing?.application?.releaseId || "");
    setEditMode(mode); setShareNotice("");
  }
  async function save() {
    if (mutation.current || !sharingReady || !editMode) return;
    mutation.current = true; setBusy(true); setError("");
    try {
      const state = editMode === "edit" ? await editMarketApplication(app.appId, shareTitle, shareSummary) : await shareMarketApplication(app.appId, selectedRelease, shareTitle, shareSummary);
      setSharing(state); setEditMode(null); setShareNotice(editMode === "edit" ? "分享信息已保存，公开版本保持不变。" : "已将选定版本分享到应用市场。");
    } catch (e) { setError(e instanceof Error ? e.message : "分享未完成，请重试"); }
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
      } else { await installMarketApplication(item); setInstalled(true); setRelease(app.releaseId); }
    }
    catch (e) { setError(e instanceof Error ? e.message : "安装没有完成，请重试"); }
    finally { mutation.current = false; setBusy(false); }
  }
  function uninstall() {
    Alert.alert("卸载应用？", "会从这台手机的应用列表移除，保留本机数据与缓存。重新安装可继续使用。", [{ text: "取消", style: "cancel" }, { text: "卸载", style: "destructive", onPress: () => { if (mutation.current) return; mutation.current = true; setBusy(true); void uninstallMarketApplication(app.appId).catch(e => { setError(String(e)); mutation.current = false; setBusy(false); }); } }]);
  }
  const Avatar = marketDefinition(item)?.avatar; const bytes = app.bundle.bytes + app.assets.reduce((total, asset) => total + asset.bytes, 0);
  const shared = sharing?.shared; const hasNewVersion = Boolean(shared && sharing?.application && shared.manifest.releaseId !== sharing.application.releaseId);
  const authorName = owner && user ? user.name : item.authorName;
  const authorAvatar = owner && user ? user.avatarUrl : item.authorAvatarUrl;
  const versionName = (manifest: MarketApplication["manifest"]) => `${manifest.version || "1.0.0"}`;
  if (item.owned && item.authorId !== user?.id) return <Screen style={styles.screen}><ScreenBar style={styles.bar}><BackChip onPress={onBack} /><Text style={styles.copy}>请登录作品所属账号后查看。</Text></ScreenBar></Screen>;
  return <Screen style={styles.screen}><ScreenBar style={styles.bar}><BackChip onPress={onBack} /><Text style={styles.barTitle}>{owner ? "作品详情" : "应用详情"}</Text></ScreenBar><ScrollView ref={scroll} contentContainerStyle={styles.content}>
    <View style={styles.hero}><View style={[styles.mark, { backgroundColor: `${app.accent}18` }]}>{Avatar ? <Avatar size={84} animated /> : <Text style={{ fontSize: 36, color: app.accent }}>{app.mark}</Text>}</View><Text style={styles.title}>{item.title || app.title}</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={styles.caption}>{authorName || "社区创作者"}</Text>{(sharing?.shared?.authorOfficial ?? item.authorOfficial) ? <Text accessibilityLabel="官方发布" style={styles.official}>官方</Text> : null}</View>{authorAvatar ? <Image accessibilityLabel="作者头像" source={{ uri: authorAvatar }} style={{ width: 32, height: 32, borderRadius: 16 }} /> : null}</View>
    <Surface style={styles.description} radius={20}><Text style={styles.subtitle}>它能帮你做什么</Text><Text style={styles.copy}>{item.summary || app.summary || "打开应用，看看它能带来什么。"}</Text></Surface>
    <View style={styles.facts}><Text style={styles.caption}>版本 {app.version || "1.0.0"}</Text><Text style={styles.caption}>安装包 {bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`}</Text><Text style={styles.caption}>数据保存在本机</Text></View>
    {item.originalAppId ? <Text style={styles.caption}>基于其他作品创作</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressy accessibilityRole="button" disabled={busy} onPress={() => installed && !update ? onOpen(app.appId) : void install()} style={styles.primary}>{busy ? <ActivityIndicator color={colors.canvas} /> : <Text style={styles.primaryText}>{installed ? update ? "加载最新作品" : "打开应用" : owner ? "加载并体验" : "安装应用"}</Text>}</Pressy>
    {installed && update ? <Pressy disabled={busy} onPress={() => onOpen(app.appId)}><Text style={styles.secondary}>先打开已安装版本</Text></Pressy> : null}
    {installed || owner ? <Pressy disabled={busy} onPress={() => { void requireAccount().then(allowed => { if (allowed) void openApplicationWorkshop(app.appId, app.title, !owner, !owner, app.releaseId).catch(e => setError(String(e))); }); }}><Text style={styles.secondary}>{owner ? "继续修改这个作品" : "基于它创作新应用"}</Text></Pressy> : null}
    {owner ? <Surface radius={20} style={styles.description}><Text style={styles.subtitle}>管理分享</Text>
      <Text style={styles.copy}>{shared ? hasNewVersion ? "已分享 · 有新版本待分享" : "已分享到应用市场" : "尚未分享"}</Text>
      {shared ? <><Text style={styles.copy}>分享名称：{shared.title || shared.manifest.title}</Text><Text style={styles.caption}>{shared.summary ?? shared.manifest.summary}</Text></> : null}
      {shared ? <Text style={styles.caption}>当前公开版本 {versionName(shared.manifest)}</Text> : null}
      {sharing?.application ? <Text style={styles.caption}>最新制作版本 {versionName(sharing.application)}</Text> : <Text style={styles.caption}>完成发包后，就可以上架。</Text>}
      {shareNotice ? <Text style={styles.caption}>{shareNotice}</Text> : null}
      {sharing?.application && (!shared || hasNewVersion) ? <Pressy disabled={busy || !sharingReady} onPress={() => begin("share")}><Text style={styles.secondary}>{shared ? hasNewVersion ? "将新版本分享到市场" : "重新分享最新制作版本" : "分享最新制作版本"}</Text></Pressy> : null}
      {shared ? <><Pressy disabled={busy || !sharingReady} onPress={() => begin("edit")}><Text style={styles.secondary}>修改分享名称与介绍</Text></Pressy><Pressy disabled={busy || !sharingReady} onPress={withdraw}><Text style={styles.secondary}>撤回分享</Text></Pressy></> : null}
      {editMode ? <View style={{ gap: 16 }} onLayout={event => { if (publish) scroll.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: true }); }}><Text style={styles.subtitle}>{editMode === "edit" ? "编辑分享信息" : "分享作品"}</Text><TextInput accessibilityLabel="分享名称" value={shareTitle} onChangeText={setShareTitle} maxLength={60} style={{ color: colors.ink1, backgroundColor: colors.field, padding: 12, borderRadius: 12 }} /><TextInput accessibilityLabel="分享介绍" value={shareSummary} onChangeText={setShareSummary} multiline maxLength={300} style={{ color: colors.ink1, backgroundColor: colors.field, padding: 12, borderRadius: 12 }} /><Text style={styles.caption}>{editMode === "edit" ? "只修改展示信息，保留当前公开版本。" : `发布版本 ${selectedRelease.slice(0, 8)} · ${runningApplicationReleases()[app.appId] === selectedRelease ? "正在体验此版本" : "此版本尚未体验"}。之后制作的版本不会自动公开。`}</Text><Pressy disabled={busy || !sharingReady || !shareTitle.trim()} onPress={() => void save()}><Text style={styles.secondary}>{editMode === "edit" ? "保存分享信息" : "发布到市场"}</Text></Pressy><Pressy disabled={busy} onPress={() => setEditMode(null)}><Text style={styles.secondary}>取消</Text></Pressy></View> : null}
    </Surface> : null}
    {installed && app.appId !== bootstrap.defaultApplication ? <Pressy disabled={busy} onPress={uninstall}><Text style={styles.secondary}>卸载应用</Text></Pressy> : null}
    {app.appId === bootstrap.defaultApplication ? <Text style={styles.caption}>Jolly 是默认伙伴，工坊就在它的主页里。</Text> : null}
  </ScrollView></Screen>;
}
const styles = themedStyleSheet(t => ({ screen: { flex: 1, backgroundColor: t.canvas }, bar: { padding: 20, flexDirection: "row", alignItems: "center", gap: 12 }, barTitle: { fontSize: 17, color: t.ink1, fontWeight: "600" }, content: { padding: 24, gap: 22, paddingBottom: 40 }, hero: { alignItems: "center", gap: 12 }, mark: { width: 84, height: 84, borderRadius: 26, alignItems: "center", justifyContent: "center", overflow: "hidden" }, title: { fontFamily: t.serif, fontSize: 29, color: t.ink1, fontWeight: "700" }, official: { color: t.accentText, backgroundColor: t.accentTint, fontSize: 12, fontWeight: "600", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, overflow: "hidden" }, caption: { fontSize: 13, color: t.ink3, lineHeight: 20 }, description: { padding: 20, gap: 10 }, subtitle: { color: t.ink1, fontSize: 16, fontWeight: "600" }, copy: { color: t.ink2, fontSize: 15, lineHeight: 24 }, facts: { gap: 6 }, primary: { backgroundColor: t.accent, borderRadius: 18, padding: 17, alignItems: "center" }, primaryText: { color: t.canvas, fontSize: 16, fontWeight: "700" }, secondary: { color: t.ink3, fontSize: 14, textAlign: "center", padding: 8 }, error: { color: t.orangeText, lineHeight: 20 } }));
