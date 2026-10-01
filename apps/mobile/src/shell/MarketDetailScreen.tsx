import { openApplicationWorkshop } from "./workshopNavigation";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from "react-native";
import { BackChip, Pressy, Surface } from "../../../../packages/ui/chrome";
import { Screen, ScreenBar } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import { loadCatalog, subscribeCatalog } from "./catalog";
import { readShellValue } from "./shellStorage";
import { shareMarketApplication, installMarketApplication, uninstallMarketApplication, marketDefinition, type MarketApplication } from "./market";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
export function MarketDetailScreen({ item, onBack, onOpen }: { item: MarketApplication; onBack: () => void; onOpen: (id: string) => void }) {
  const { colors } = useTheme(); const app = item.manifest;
  const [installed, setInstalled] = useState(false); const [release, setRelease] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    const update = async (entries: Awaited<ReturnType<typeof loadCatalog>>) => {
      setInstalled(entries.some(entry => entry.id === app.appId && !entry.trashedAt && !entry.purged));
      const raw = await readShellValue(`application.pending.${app.appId}`) || await readShellValue(`application.install.${app.appId}`);
      try { setRelease(raw ? JSON.parse(raw).releaseId : ""); } catch { setRelease(""); }
    };
    void loadCatalog().then(update); return subscribeCatalog(entries => { void update(entries); });
  }, [app.appId]);
  const [owner, setOwner] = useState(false);
  const [accepted, setAccepted] = useState("");
  const [editingShare, setEditingShare] = useState(false);
  const [shareTitle, setShareTitle] = useState(item.title || app.title);
  const [shareSummary, setShareSummary] = useState(item.summary || app.summary);
  const [shared, setShared] = useState(false);
  useEffect(() => { void readShellValue(`shell.jules.apps.${app.appId}.token`).then(token => setOwner(Boolean(token))); void readShellValue(`shell.workshop.accepted.${app.appId}`).then(raw => { try { setAccepted(raw ? JSON.parse(raw).releaseId : ""); } catch {} }); }, [app.appId]);
  async function share() { setBusy(true); setError(""); try { await shareMarketApplication(app.appId, accepted, shareTitle, shareSummary); setShared(true); setEditingShare(false); } catch (e) { setError(e instanceof Error ? e.message : "分享失败"); } finally { setBusy(false); } }
  const update = installed && !owner && item.latest && release && release !== app.releaseId;
  async function install() {
    if (busy) return; setBusy(true); setError("");
    try { await installMarketApplication(item); setInstalled(true); setRelease(app.releaseId); }
    catch (e) { setError(e instanceof Error ? e.message : "安装没有完成，请重试"); }
    finally { setBusy(false); }
  }
  function uninstall() {
    Alert.alert("卸载应用？", "会从这台手机的应用列表移除，保留本机数据与缓存。重新安装可继续使用。", [{ text: "取消", style: "cancel" }, { text: "卸载", style: "destructive", onPress: () => { setBusy(true); void uninstallMarketApplication(app.appId).catch(e => { setError(String(e)); setBusy(false); }); } }]);
  }
  const Avatar = marketDefinition(item)?.avatar;
  const bytes = app.bundle.bytes + app.assets.reduce((total, asset) => total + asset.bytes, 0);
  return <Screen style={styles.screen}><ScreenBar style={styles.bar}><BackChip onPress={onBack} /><Text style={styles.barTitle}>应用详情</Text></ScreenBar><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.hero}><View style={[styles.mark, { backgroundColor: `${app.accent}18` }]}>{Avatar ? <Avatar size={84} animated /> : <Text style={{ fontSize: 36, color: app.accent }}>{app.mark}</Text>}</View><Text style={styles.title}>{item.title || app.title}</Text><Text style={styles.caption}>{item.authorName || "社区创作者"}</Text></View>
    <Surface style={styles.description} radius={20}><Text style={styles.subtitle}>它能帮你做什么</Text><Text style={styles.copy}>{item.summary || app.summary || "打开应用，看看它能带来什么。"}</Text></Surface>
    <View style={styles.facts}><Text style={styles.caption}>版本 {app.version || "1.0.0"}</Text><Text style={styles.caption}>安装包 {bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`}</Text><Text style={styles.caption}>数据保存在本机</Text></View>
    {item.originalAppId ? <Text style={styles.caption}>基于应用 {item.originalAppId} 创作</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressy accessibilityRole="button" disabled={busy} onPress={() => installed && !update ? onOpen(app.appId) : void install()} style={styles.primary}>{busy ? <ActivityIndicator color={colors.canvas} /> : <Text style={styles.primaryText}>{installed ? update ? "更新应用 · 完成后重载" : "打开应用" : "安装应用"}</Text>}</Pressy>
    {installed && update ? <Pressy disabled={busy} onPress={() => onOpen(app.appId)}><Text style={styles.secondary}>先打开已安装版本</Text></Pressy> : null}
    {installed ? <Pressy disabled={busy} onPress={() => openApplicationWorkshop(app.appId, app.title, !owner)}><Text style={styles.secondary}>{owner ? "继续修改这个应用" : "基于它创作新应用"}</Text></Pressy> : null}
    {installed && owner && accepted ? <Pressy disabled={busy} onPress={() => setEditingShare(!editingShare)}><Text style={styles.secondary}>{shared ? "已分享到应用市场" : "分享已收下的版本"}</Text></Pressy> : null}
    {editingShare ? <Surface radius={20} style={styles.description}><Text style={styles.subtitle}>分享已收下的作品</Text><TextInput accessibilityLabel="分享名称" value={shareTitle} onChangeText={setShareTitle} maxLength={60} style={{ color: colors.ink1, backgroundColor: colors.field, padding: 12, borderRadius: 12 }} /><TextInput accessibilityLabel="一句话介绍" value={shareSummary} onChangeText={setShareSummary} multiline maxLength={300} style={{ color: colors.ink1, backgroundColor: colors.field, padding: 12, borderRadius: 12 }} /><Text style={styles.caption}>分享锁定已收下的版本，后续修改不会自动更新市场。</Text><Pressy disabled={busy || !shareTitle.trim()} onPress={() => void share()}><Text style={styles.secondary}>确认分享到市场</Text></Pressy></Surface> : null}
    {installed && app.appId !== bootstrap.defaultApplication ? <Pressy accessibilityRole="button" disabled={busy} onPress={uninstall}><Text style={styles.secondary}>卸载应用</Text></Pressy> : null}
    {app.appId === bootstrap.defaultApplication ? <Text style={styles.caption}>Jolly 是默认伙伴，工坊就在它的主页里。</Text> : null}
  </ScrollView></Screen>;
}
const styles = themedStyleSheet(t => ({ screen: { flex: 1, backgroundColor: t.canvas }, bar: { padding: 20, flexDirection: "row", alignItems: "center", gap: 12 }, barTitle: { fontSize: 17, color: t.ink1, fontWeight: "600" }, content: { padding: 24, gap: 22, paddingBottom: 40 }, hero: { alignItems: "center", gap: 12 }, mark: { width: 84, height: 84, borderRadius: 26, alignItems: "center", justifyContent: "center", overflow: "hidden" }, title: { fontFamily: t.serif, fontSize: 29, color: t.ink1, fontWeight: "700" }, caption: { fontSize: 13, color: t.ink3, lineHeight: 20 }, description: { padding: 20, gap: 10 }, subtitle: { color: t.ink1, fontSize: 16, fontWeight: "600" }, copy: { color: t.ink2, fontSize: 15, lineHeight: 24 }, facts: { gap: 6 }, primary: { backgroundColor: t.accent, borderRadius: 18, padding: 17, alignItems: "center" }, primaryText: { color: t.canvas, fontSize: 16, fontWeight: "700" }, secondary: { color: t.ink3, fontSize: 14, textAlign: "center", padding: 8 }, error: { color: t.orangeText, lineHeight: 20 } }));
