import {
  currentAccountId,
  requireAccount,
  useAccount,
  uploadMarketScreenshot,
} from "./account";
import { openApplicationWorkshop } from "./workshopNavigation";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import {
  KeyboardAwareScrollView as ScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import { MediaPicker as ImagePicker } from "../../../../packages/ui/media/MediaPicker";
import { AppImage } from "../../../../packages/ui/media/AppImage";
import Toast from "react-native-toast-message";
import { FormField as TextInput } from "./FormField";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EdgeModal, Screen, ScreenEdge } from "../../../../packages/ui/edge";
import {
  ThemeContext,
  themedStyleSheet,
  useTheme,
} from "../../../../packages/ui/theme";
import { loadCatalog, subscribeCatalog } from "./catalog";
import {
  readShellValue,
  writeShellValue,
  removeShellValue,
} from "./shellStorage";
import {
  offerApplication,
  applyApplicationUpdate,
  runningApplication,
  runningApplicationReleases,
  type ApplicationManifest,
} from "../runtime/applications";

import {
  cachedSharing,
  loadSharing,
  editMarketApplication,
  withdrawMarketApplication,
  shareMarketApplication,
  installMarketApplication,
  uninstallMarketApplication,
  marketCategories,
  marketDefinition,
  type MarketApplication,
  type SharingState,
} from "./market";
import { PixelText as Text } from "./feed/PixelText";
import { PixelIcon } from "./feed/PixelKit";
import { pixelTheme, usePixelTheme } from "./feed/pixelTheme";
import { KeyboardViewport } from "./KeyboardViewport";
import { useRouteContentReady } from "./useRouteContentReady";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
export function MarketPublicationScreen(
  props: Parameters<typeof MarketDetailContent>[0]
) {
  const theme = usePixelTheme();
  return (
    <ThemeContext.Provider value={theme}>
      <MarketDetailContent {...props} publication />
    </ThemeContext.Provider>
  );
}
export function MarketDetailScreen(
  props: Parameters<typeof MarketDetailContent>[0]
) {
  const theme = usePixelTheme();
  return (
    <ThemeContext.Provider value={theme}>
      <MarketDetailContent {...props} />
    </ThemeContext.Provider>
  );
}
function MarketDetailContent({
  item,
  publication = false,
  onPublication,
  onBack,
  onOpen,
  onModify,
  onSharePost,
  onAuthor,
}: {
  onModify: (manifest: ApplicationManifest, ownerId: string) => void;
  onAuthor: (author: {
    id: string;
    name: string;
    avatarUrl: string | null;
    official?: boolean;
  }) => void;
  publication?: boolean;
  onPublication?: () => void;
  item: MarketApplication;
  onBack: () => void;
  onOpen: (id: string) => void;
  onSharePost: (item: MarketApplication) => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useAccount();
  const { colors } = useTheme();
  const app = item.manifest;
  const contentReady = useRouteContentReady();
  const focused = useIsFocused() && contentReady;
  const [installed, setInstalled] = useState(false);
  const [release, setRelease] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localReady, setLocalReady] = useState(false);
  const [ownershipReady, setOwnershipReady] = useState(false);
  const [ownerAccount, setOwnerAccount] = useState<string>();
  const owner = !!ownerAccount && ownerAccount === user?.id;
  const [sharing, setSharing] = useState<SharingState>();
  const [sharingReady, setSharingReady] = useState(false);
  const [shareNotice, setShareNotice] = useState("");
  const [sharingAttempt, setSharingAttempt] = useState(0);
  const [draftOwner, setDraftOwner] = useState<string>();
  const draftKey = `market.edit-draft.${draftOwner}.${app.appId}`;
  const [editMode, setEditMode] = useState<"edit" | "share" | null>(null);
  const [selectedRelease, setSelectedRelease] = useState("");
  const [shareTitle, setShareTitle] = useState(item.title || app.title);
  const [shareSummary, setShareSummary] = useState(item.summary || app.summary);
  const [shareCategory, setShareCategory] = useState(item.category || "other");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [preview, setPreview] = useState<string>();
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    []
  );
  usePreventRemove(busy, () =>
    Toast.show({ type: "info", text1: "正在处理，请稍候" })
  );
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const mutation = useRef(false);
  async function modify() {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    try {
      if (!(await requireAccount())) return;
      const ownerId = await currentAccountId();
      if (!ownerId) return;
      const manifest =
        (installed ? runningApplication(app.appId) : undefined) ??
        (owner ? sharing?.application : undefined) ??
        app;
      onModify(manifest, ownerId);
    } catch (e) {
      Toast.show({
        type: "error",
        text1: e instanceof Error ? e.message : "无法打开反馈页",
      });
    } finally {
      mutation.current = false;
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!contentReady) return;
    let live = true;
    const update = async (entries: Awaited<ReturnType<typeof loadCatalog>>) => {
      const raw =
        (await readShellValue(`application.pending.${app.appId}`)) ||
        (await readShellValue(`application.install.${app.appId}`));
      if (!live) return;
      setInstalled(
        entries.some(
          (entry) => entry.id === app.appId && !entry.trashedAt && !entry.purged
        )
      );
      try {
        setRelease(raw ? JSON.parse(raw).releaseId : "");
      } catch {
        setRelease("");
      }
      setLocalReady(true);
    };
    void loadCatalog()
      .then(update)
      .catch(() => {
        if (live) {
          setLocalReady(true);
          setError("本机应用状态未能读取，请重新打开详情");
        }
      });
    const off = subscribeCatalog((entries) => {
      void update(entries);
    });
    return () => {
      live = false;
      off();
    };
  }, [app.appId, contentReady]);
  useEffect(() => {
    if (!focused) return;
    let live = true;
    async function refresh() {
      setSharingReady(false);
      setOwnershipReady(false);
      const accountId = await currentAccountId();
      const owned =
        Boolean(accountId) &&
        (await readShellValue(`shell.jules.apps.${app.appId}.owner`)) ===
          accountId;
      if (!live) return;
      setOwnerAccount(owned ? accountId : undefined);
      setOwnershipReady(true);
      if (!owned) {
        setSharing(undefined);
        setEditMode(null);
        return;
      }
      const cached = await cachedSharing(app.appId);
      if (live && cached) setSharing(cached);
      try {
        const state = await loadSharing(app.appId);
        if (live) {
          setSharing(state);
          setSharingReady(true);
          setShareNotice("");
        }
      } catch {
        if (live) setShareNotice("分享状态暂未接回，请稍后重新打开详情。");
      }
    }
    const idle = requestIdleCallback(() => {
      void refresh().catch(() => {
        if (live) {
          setOwnershipReady(true);
          setShareNotice("作品状态暂未同步，请重试");
        }
      });
    });
    return () => {
      live = false;
      cancelIdleCallback(idle);
    };
  }, [app.appId, focused, user?.id, sharingAttempt]);
  useEffect(() => {
    if (editMode && draftOwner === user?.id)
      writeShellValue(
        draftKey,
        JSON.stringify({
          mode: editMode,
          releaseId: selectedRelease,
          title: shareTitle,
          summary: shareSummary,
          category: shareCategory,
          screenshots,
        })
      );
  }, [
    editMode,
    draftOwner,
    user?.id,
    selectedRelease,
    shareTitle,
    shareSummary,
    shareCategory,
    screenshots,
  ]);
  useEffect(() => {
    if (draftOwner !== user?.id) setEditMode(null);
  }, [draftOwner, user?.id]);
  async function begin(mode: "edit" | "share") {
    const ownerId = user?.id;
    if (!ownerId) return;
    setDraftOwner(ownerId);
    setShareTitle(
      sharing?.shared?.title ||
        sharing?.application?.title ||
        item.title ||
        app.title
    );
    setShareSummary(
      sharing?.shared?.summary ??
        sharing?.application?.summary ??
        item.summary ??
        app.summary
    );
    setSelectedRelease(sharing?.application?.releaseId || "");
    setShareCategory(sharing?.shared?.category || item.category || "other");
    setScreenshots(sharing?.shared?.screenshots || item.screenshots || []);
    setShareNotice("");
    try {
      const cached = JSON.parse(
        (await readShellValue(`market.edit-draft.${ownerId}.${app.appId}`)) ||
          "null"
      );
      if (!alive.current || (await currentAccountId()) !== ownerId) return;
      if (
        cached?.mode === mode &&
        (mode === "edit" ||
          cached.releaseId === sharing?.application?.releaseId)
      ) {
        if (typeof cached.title === "string") setShareTitle(cached.title);
        if (typeof cached.summary === "string") setShareSummary(cached.summary);
        if (marketCategories.some((item) => item.id === cached.category))
          setShareCategory(cached.category);
        if (Array.isArray(cached.screenshots))
          setScreenshots(
            cached.screenshots
              .filter(
                (url: unknown) =>
                  typeof url === "string" && url.startsWith("https://")
              )
              .slice(0, 6)
          );
      }
    } catch {
      /* Use the current published fields when a draft is invalid. */
    }
    if (alive.current && (await currentAccountId()) === ownerId)
      setEditMode(mode);
  }
  async function chooseScreenshots() {
    if (mutation.current || screenshots.length >= 6) return;
    const accountId = await currentAccountId();
    if (!accountId) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    setUploadStatus("正在选择截图…");
    let paths: string[] = [];
    try {
      const images = await ImagePicker.openPicker({
        mediaType: "photo",
        multiple: true,
        maxFiles: 6 - screenshots.length,
        forceJpg: true,
        compressImageMaxWidth: 1600,
        compressImageMaxHeight: 2400,
        compressImageQuality: 0.75,
      });
      paths = images.map((image) => image.path);
      if (images.length > 6 - screenshots.length)
        throw new Error("截图最多六张，请减少选择数量");
      for (let index = 0; index < images.length; index++) {
        if (images[index].size > 2 * 1024 * 1024)
          throw new Error("截图压缩后仍超过 2 MB，请选择较小的图片");
        if (!alive.current || (await currentAccountId()) !== accountId)
          throw new Error("账号已改变，请重试");
        setUploadStatus(`正在上传截图 ${index + 1}/${images.length}…`);
        const url = await uploadMarketScreenshot(app.appId, images[index].path);
        if (alive.current && (await currentAccountId()) === accountId)
          setScreenshots((previous) =>
            [...new Set([...previous, url])].slice(0, 6)
          );
      }
    } catch (e) {
      if (
        (e as { code?: string }).code !== "E_PICKER_CANCELLED" &&
        alive.current
      ) {
        const message = e instanceof Error ? e.message : "截图上传失败，请重试";
        setError(message);
        Toast.show({ type: "error", text1: message });
      }
    } finally {
      for (const path of paths)
        void ImagePicker.cleanSingle(path).catch(() => {});
      mutation.current = false;
      if (alive.current) {
        setBusy(false);
        setUploadStatus("");
      }
    }
  }
  async function save() {
    if (mutation.current || !sharingReady || !editMode) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      const state =
        editMode === "edit"
          ? await editMarketApplication(
              app.appId,
              shareTitle,
              shareSummary,
              shareCategory,
              screenshots
            )
          : await shareMarketApplication(
              app.appId,
              selectedRelease,
              shareTitle,
              shareSummary,
              shareCategory,
              screenshots
            );
      Toast.show({
        type: "success",
        text1: editMode === "edit" ? "市场信息已保存" : "作品已上架",
      });
      removeShellValue(draftKey);
      setSharing(state);
      setEditMode(null);
      setShareNotice(
        editMode === "edit"
          ? "分享信息已保存，公开版本保持不变。"
          : "已将选定版本分享到应用市场。"
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "分享未完成，请重试";
      setError(message);
      Toast.show({ type: "error", text1: message });
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  function withdraw() {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    void withdrawMarketApplication(app.appId)
      .then((state) => {
        setSharing(state);
        setEditMode(null);
        setShareNotice("已撤回分享，作品仍保留在我的作品中。");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "撤回未完成"))
      .finally(() => {
        mutation.current = false;
        setBusy(false);
      });
  }
  const targetRelease = owner
    ? sharing?.application?.releaseId ?? app.releaseId
    : app.releaseId;
  const update =
    installed && (owner || item.latest) && release && release !== targetRelease;
  async function install() {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      if (owner && user) {
        offerApplication(sharing?.application ?? app, user.id);
        const changed = await applyApplicationUpdate(app.appId);
        if (!changed) onOpen(app.appId);
      } else {
        await installMarketApplication(item);
        setInstalled(true);
        setRelease(app.releaseId);
        onOpen(app.appId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "安装没有完成，请重试");
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  function uninstall() {
    Alert.alert(
      "卸载应用？",
      "会从这台手机的应用列表移除，保留本机数据与缓存。重新安装可继续使用。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "卸载",
          style: "destructive",
          onPress: () => {
            if (mutation.current) return;
            mutation.current = true;
            setBusy(true);
            void uninstallMarketApplication(app.appId)
              .then(() => {
                if (alive.current) {
                  setInstalled(false);
                  setRelease("");
                }
              })
              .catch((e) => {
                if (alive.current)
                  setError(
                    e instanceof Error ? e.message : "卸载未完成，请重试"
                  );
              })
              .finally(() => {
                mutation.current = false;
                if (alive.current) setBusy(false);
              });
          },
        },
      ]
    );
  }
  const Avatar = marketDefinition(item)?.avatar;
  const shared = sharing?.shared;
  const hasNewVersion = Boolean(
    shared &&
      sharing?.application &&
      shared.manifest.releaseId !== sharing.application.releaseId
  );
  const gallery = shared?.screenshots || item.screenshots || [];
  const authorName = owner && user ? user.name : item.authorName;
  const authorAvatar = owner && user ? user.avatarUrl : item.authorAvatarUrl;
  const authorId = owner && user ? user.id : item.authorId;
  function visitAuthor() {
    if (authorId)
      onAuthor({
        id: authorId,
        name: authorName || "社区创作者",
        avatarUrl: authorAvatar ?? null,
        official: sharing?.shared?.authorOfficial ?? item.authorOfficial,
      });
  }
  const versionName = (manifest: MarketApplication["manifest"]) =>
    `${manifest.version || "1.0.0"}`;
  const ownsSurface = owner || (item.owned && item.authorId === user?.id);
  const canManage = owner && sharingReady;
  const latest = sharing?.application ?? app;
  const displayed = ownsSurface ? latest : app;
  const bytes =
    displayed.bundle.bytes +
    displayed.assets.reduce((total, asset) => total + asset.bytes, 0);
  function continueCreation() {
    void requireAccount().then((allowed) => {
      if (allowed)
        void openApplicationWorkshop(
          app.appId,
          app.title,
          !owner,
          !owner,
          app.releaseId
        ).catch((cause) =>
          setError(cause instanceof Error ? cause.message : "工坊未能打开")
        );
    });
  }
  function closeEditor() {
    if (!busy) setEditMode(null);
  }
  const summary = (shared?.summary ?? item.summary ?? app.summary ?? "").trim();
  const management = owner ? (
    <View style={styles.management}>
      <View style={styles.line}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <PixelIcon name="box" size={18} color={colors.greenText} />
          <Text style={styles.subtitle}>公开到应用市场</Text>
        </View>
        <Text
          style={[
            styles.tag,
            {
              backgroundColor: shared ? colors.greenTint : colors.orchidTint,
              color: shared ? colors.greenText : colors.orchidText,
            },
          ]}
        >
          {!sharingReady ? "待同步" : shared ? "已上架" : "仅自己可见"}
        </Text>
      </View>
      {!sharingReady && !shareNotice ? (
        <View style={styles.note}>
          <ActivityIndicator color={colors.greenText} />
          <Text style={styles.caption}>正在读取作品状态…</Text>
        </View>
      ) : (
        <Text style={styles.copy}>
          {shared
            ? hasNewVersion
              ? "制作已有新版，市场仍展示上次公开的版本。"
              : "大家可以在市场找到这份作品。"
            : "上架后，其他人就能安装和体验你的作品。"}
        </Text>
      )}
      {shared ? (
        <View style={styles.versionLine}>
          <Text style={styles.caption}>
            公开版本 {versionName(shared.manifest)}
          </Text>
          <Text style={styles.caption}>制作版本 {versionName(latest)}</Text>
        </View>
      ) : null}
      {shareNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.caption}>
          {shareNotice}
        </Text>
      ) : null}
      {!sharingReady && shareNotice ? (
        <Pressy
          disabled={busy}
          onPress={() => setSharingAttempt((value) => value + 1)}
          style={styles.retry}
        >
          <PixelIcon name="refresh" size={16} color={colors.greenText} />
          <Text style={{ color: colors.greenText, fontSize: 12 }}>
            重新读取状态
          </Text>
        </Pressy>
      ) : null}
      {sharing?.application && (!shared || hasNewVersion) ? (
        <Pressy
          disabled={busy || !canManage}
          onPress={() => void begin("share")}
          style={styles.marketPrimary}
        >
          <PixelIcon name="box" size={18} color={colors.onAccent} />
          <Text style={styles.primaryText}>
            {shared ? "上架制作新版" : "上架作品"}
          </Text>
        </Pressy>
      ) : null}
      {shared ? (
        <View style={styles.managementActions}>
          <Pressy
            disabled={busy || !canManage}
            onPress={() => void begin("edit")}
            style={styles.managementAction}
          >
            <PixelIcon name="edit" size={16} color={colors.orchidText} />
            <Text style={{ color: colors.orchidText, fontSize: 12 }}>
              编辑市场信息
            </Text>
          </Pressy>
          <Pressy
            disabled={busy || !canManage}
            onPress={withdraw}
            style={styles.managementAction}
          >
            <PixelIcon name="close" size={16} color={colors.redText} />
            <Text style={{ color: colors.redText, fontSize: 12 }}>
              撤回上架
            </Text>
          </Pressy>
        </View>
      ) : null}
      {sharingReady && !sharing?.application ? (
        <Text style={styles.caption}>作品完成制作后即可上架。</Text>
      ) : null}
    </View>
  ) : (
    <View style={styles.note}>
      {!ownershipReady ? (
        <ActivityIndicator color={colors.orchidText} />
      ) : (
        <PixelIcon name="mine" size={20} color={colors.orchidText} />
      )}
      <Text style={styles.copy}>
        {!ownershipReady
          ? "正在读取作者权限…"
          : shareNotice || "仅作品作者可管理公开状态。"}
      </Text>
      {ownershipReady && shareNotice ? (
        <Pressy
          onPress={() => setSharingAttempt((value) => value + 1)}
          accessibilityLabel="重新读取作者权限"
        >
          <PixelIcon name="refresh" size={18} color={colors.orchidText} />
        </Pressy>
      ) : null}
    </View>
  );
  const primaryLabel = !localReady
    ? "正在读取应用…"
    : installed
    ? "打开应用"
    : ownsSurface
    ? "加载并体验"
    : "安装并打开";
  if (item.owned && item.authorId !== user?.id)
    return (
      <Screen style={styles.screen}>
        <PageHeader variant="pixel" title="作品详情" onBack={onBack} />
        <View style={styles.empty}>
          <PixelIcon name="mine" size={32} color={colors.orchidText} />
          <Text style={styles.copy}>请登录作品所属账号后查看。</Text>
          <Pressy onPress={() => void requireAccount()} style={styles.primary}>
            <Text style={styles.primaryText}>登录</Text>
          </Pressy>
        </View>
      </Screen>
    );
  return (
    <ScreenEdge bottom={false}>
      <Screen style={styles.screen}>
        <PageHeader
          variant="pixel"
          title={
            editMode
              ? editMode === "edit"
                ? "编辑市场信息"
                : "上架作品"
              : publication
              ? "公开到应用市场"
              : ownsSurface
              ? "作品详情"
              : "应用详情"
          }
          onBack={editMode ? closeEditor : onBack}
          right={
            !publication && !editMode && owner && onPublication ? (
              <Pressy
                accessibilityLabel="公开到应用市场"
                onPress={onPublication}
                scale={1}
                style={{ width: 44, height: 44, alignItems: "center" }}
              >
                <PixelIcon name="send" size={20} color={colors.orchidText} />
              </Pressy>
            ) : undefined
          }
        />
        <KeyboardViewport backgroundColor={colors.canvas}>
          <ScrollView
            key={editMode ? "editor" : "detail"}
            ref={scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bottomOffset={24}
            contentContainerStyle={styles.content}
          >
            {editMode ? (
              <>
                <View
                  style={[styles.note, { backgroundColor: colors.orchidTint }]}
                >
                  <PixelIcon name="box" size={18} color={colors.orchidText} />
                  <Text
                    style={[
                      styles.caption,
                      { flex: 1, color: colors.orchidText },
                    ]}
                  >
                    {editMode === "edit"
                      ? "修改名称、介绍和截图，当前公开版本保持不变。"
                      : "选择怎样介绍你的作品。上架后，所有人都能在市场找到它。"}
                  </Text>
                </View>
                <View style={styles.fieldGroup}>
                  <View style={styles.line}>
                    <Text style={styles.subtitle}>作品名称</Text>
                    <Text style={styles.caption}>{shareTitle.length}/60</Text>
                  </View>
                  <TextInput
                    accessibilityLabel="作品名称"
                    editable={!busy}
                    value={shareTitle}
                    onChangeText={setShareTitle}
                    maxLength={60}
                    placeholder="给作品起个名字"
                    placeholderTextColor={colors.ink3}
                    style={styles.input}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <View style={styles.line}>
                    <Text style={styles.subtitle}>作品介绍</Text>
                    <Text style={styles.caption}>
                      {shareSummary.length}/300
                    </Text>
                  </View>
                  <TextInput
                    accessibilityLabel="作品介绍"
                    editable={!busy}
                    value={shareSummary}
                    onChangeText={setShareSummary}
                    multiline
                    scrollEnabled
                    maxLength={300}
                    placeholder="它能帮大家做什么？"
                    placeholderTextColor={colors.ink3}
                    style={[
                      styles.input,
                      { height: 120, textAlignVertical: "top" },
                    ]}
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.subtitle}>分类</Text>
                  <View style={styles.categories}>
                    {marketCategories
                      .filter((category) => category.id)
                      .map((category) => (
                        <Pressy
                          key={category.id}
                          disabled={busy}
                          accessibilityState={{
                            selected: shareCategory === category.id,
                          }}
                          onPress={() => setShareCategory(category.id)}
                          style={[
                            styles.chip,
                            {
                              backgroundColor:
                                shareCategory === category.id
                                  ? colors.accent
                                  : colors.surface,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color:
                                shareCategory === category.id
                                  ? colors.onAccent
                                  : colors.ink2,
                              fontSize: 12,
                            }}
                          >
                            {category.label}
                          </Text>
                        </Pressy>
                      ))}
                  </View>
                </View>
                <View style={styles.fieldGroup}>
                  <View style={styles.line}>
                    <Text style={styles.subtitle}>真实截图 · 可选</Text>
                    <Text style={styles.caption}>{screenshots.length}/6</Text>
                  </View>
                  <View style={styles.categories}>
                    {screenshots.map((url, index) => (
                      <View key={url} style={styles.editShot}>
                        <Pressy
                          scale={1}
                          onPress={() => setPreview(url)}
                          accessibilityLabel={`预览截图 ${index + 1}`}
                        >
                          <AppImage
                            source={{ uri: url }}
                            style={styles.editImage}
                            resizeMode="contain"
                          />
                        </Pressy>
                        <Pressy
                          disabled={busy}
                          onPress={() =>
                            setScreenshots((previous) =>
                              previous.filter((value) => value !== url)
                            )
                          }
                          accessibilityLabel={`移除截图 ${index + 1}`}
                          style={styles.removeShot}
                        >
                          <PixelIcon
                            name="close"
                            size={16}
                            color={colors.redText}
                          />
                        </Pressy>
                      </View>
                    ))}
                    {screenshots.length < 6 ? (
                      <Pressy
                        disabled={busy}
                        onPress={() => void chooseScreenshots()}
                        accessibilityLabel="添加截图"
                        style={styles.addShot}
                      >
                        <PixelIcon
                          name="photo"
                          size={24}
                          color={colors.orchidText}
                        />
                        <Text
                          style={{ color: colors.orchidText, fontSize: 11 }}
                        >
                          添加截图
                        </Text>
                      </Pressy>
                    ) : null}
                  </View>
                  <Text style={styles.caption}>
                    上传真实的使用画面，第一张用于市场预览。
                  </Text>
                </View>
                {uploadStatus ? (
                  <View style={styles.note}>
                    <ActivityIndicator color={colors.orchidText} />
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.caption}
                    >
                      {uploadStatus}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.caption}>
                  {editMode === "edit"
                    ? "草稿会自动保留，返回后可以继续编辑。"
                    : `上架制作版本 ${versionName(
                        latest
                      )}。之后制作的新版不会自动公开。`}
                </Text>
              </>
            ) : publication ? (
              management
            ) : (
              <>
                <View style={styles.hero}>
                  <View style={styles.mark}>
                    {Avatar ? (
                      <Avatar size={56} animated />
                    ) : (
                      <Text style={{ fontSize: 30, color: app.accent }}>
                        {app.mark}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                    <Text
                      style={styles.title}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {shared?.title || item.title || app.title}
                    </Text>
                    <View style={styles.tags}>
                      <Text style={styles.tag}>
                        {marketCategories.find(
                          (category) =>
                            category.id ===
                            (shared?.category || item.category || "other")
                        )?.label || "其他"}
                      </Text>
                      {shared?.authorOfficial ?? item.authorOfficial ? (
                        <Text style={styles.official}>官方</Text>
                      ) : null}
                      <Text style={styles.caption}>
                        {localReady
                          ? installed
                            ? "已安装"
                            : "未安装"
                          : "读取本机状态…"}
                      </Text>
                    </View>
                  </View>
                </View>
                {summary ? (
                  <View style={styles.description}>
                    <Text style={styles.copy}>{summary}</Text>
                  </View>
                ) : null}
                {gallery.length ? (
                  <View style={styles.gallery}>
                    <View style={styles.line}>
                      <Text style={styles.subtitle}>使用预览</Text>
                      <Text style={styles.caption}>{gallery.length} 张</Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 10 }}
                    >
                      {gallery.map((url, index) => (
                        <Pressy
                          scale={1}
                          key={url}
                          accessibilityLabel={`查看截图 ${index + 1}`}
                          onPress={() => setPreview(url)}
                        >
                          <AppImage
                            source={{ uri: url }}
                            style={styles.galleryImage}
                            resizeMode="contain"
                          />
                        </Pressy>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}
                <Pressy
                  scale={1}
                  disabled={!authorId}
                  accessibilityLabel={`查看${authorName || "创作者"}的主页`}
                  onPress={visitAuthor}
                  style={styles.author}
                >
                  <View style={styles.authorIdentity}>
                    {authorAvatar ? (
                      <AppImage
                        source={{ uri: authorAvatar }}
                        style={{ width: 28, height: 28, borderRadius: 14 }}
                      />
                    ) : (
                      <PixelIcon
                        name="mine"
                        size={24}
                        color={colors.orchidText}
                      />
                    )}
                    <Text
                      numberOfLines={1}
                      style={{
                        color: colors.ink2,
                        fontSize: 13,
                        flexShrink: 1,
                      }}
                    >
                      {authorName || "社区创作者"}
                    </Text>
                  </View>
                  <PixelIcon name="arrow" size={16} color={colors.ink3} />
                </Pressy>
                <View style={styles.facts}>
                  <View style={styles.fact}>
                    <Text style={styles.caption}>版本</Text>
                    <Text style={styles.factValue}>
                      {versionName(ownsSurface ? latest : app)}
                    </Text>
                  </View>
                  <View style={styles.fact}>
                    <Text style={styles.caption}>应用大小</Text>
                    <Text style={styles.factValue}>
                      {bytes >= 1048576
                        ? `${(bytes / 1048576).toFixed(1)} MB`
                        : `${Math.ceil(bytes / 1024)} KB`}
                    </Text>
                  </View>
                  {item.originalAppId ? (
                    <View style={styles.fact}>
                      <Text style={styles.caption}>创作方式</Text>
                      <Text style={styles.factValue}>基于作品创作</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.tools}>
                  <Pressy
                    disabled={
                      busy ||
                      !ownershipReady ||
                      app.appId === bootstrap.defaultApplication
                    }
                    onPress={() => (owner ? void modify() : continueCreation())}
                    style={[styles.tool, { backgroundColor: colors.cyanTint }]}
                  >
                    <PixelIcon
                      name={owner ? "edit" : "spark"}
                      size={18}
                      color={colors.cyanText}
                    />
                    <Text style={[styles.toolText, { color: colors.cyanText }]}>
                      {owner ? "修改" : "Remix"}
                    </Text>
                  </Pressy>
                  <Pressy
                    disabled={busy || (ownsSurface && (!shared || !canManage))}
                    accessibilityLabel={
                      ownsSurface && !shared
                        ? "分享，公开作品后可用"
                        : "分享作品到动态"
                    }
                    onPress={() => onSharePost(shared ?? item)}
                    style={[
                      styles.tool,
                      { backgroundColor: colors.orchidTint },
                    ]}
                  >
                    <PixelIcon
                      name="share"
                      size={18}
                      color={colors.orchidText}
                    />
                    <Text
                      style={[styles.toolText, { color: colors.orchidText }]}
                    >
                      分享
                    </Text>
                  </Pressy>
                  <Pressy
                    disabled={
                      busy ||
                      !installed ||
                      app.appId === bootstrap.defaultApplication
                    }
                    onPress={uninstall}
                    style={[styles.tool, { backgroundColor: colors.redTint }]}
                  >
                    <PixelIcon name="close" size={18} color={colors.redText} />
                    <Text style={[styles.toolText, { color: colors.redText }]}>
                      卸载
                    </Text>
                  </Pressy>
                </View>
              </>
            )}
            {error ? (
              <View
                accessibilityLiveRegion="polite"
                style={[styles.note, { backgroundColor: colors.redTint }]}
              >
                <PixelIcon name="alert" size={18} color={colors.redText} />
                <Text style={[styles.error, { flex: 1 }]}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>
          {!publication || editMode ? (
            <View style={styles.dock}>
              {editMode ? (
                <Pressy
                  disabled={busy || !canManage || !shareTitle.trim()}
                  onPress={() => void save()}
                  style={[styles.primary, { flex: 1 }]}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <PixelIcon name="check" size={18} color={colors.onAccent} />
                  )}
                  <Text style={styles.primaryText}>
                    {busy
                      ? uploadStatus
                        ? "正在上传截图…"
                        : "正在保存…"
                      : editMode === "edit"
                      ? "保存信息"
                      : "发布到市场"}
                  </Text>
                </Pressy>
              ) : (
                <>
                  {installed && update ? (
                    <Pressy
                      accessibilityLabel="更新应用"
                      disabled={busy}
                      onPress={() => void install()}
                      style={styles.updateButton}
                    >
                      <PixelIcon
                        name="refresh"
                        size={18}
                        color={colors.orchidText}
                      />
                      <Text style={{ color: colors.orchidText, fontSize: 12 }}>
                        更新
                      </Text>
                    </Pressy>
                  ) : null}
                  <Pressy
                    disabled={
                      busy ||
                      !localReady ||
                      (!installed &&
                        (!ownershipReady || (ownsSurface && !owner)))
                    }
                    onPress={() =>
                      installed ? onOpen(app.appId) : void install()
                    }
                    style={[styles.primary, { flex: 1 }]}
                  >
                    {busy ? (
                      <ActivityIndicator color={colors.onAccent} />
                    ) : (
                      <PixelIcon name="box" size={18} color={colors.onAccent} />
                    )}
                    <Text style={styles.primaryText}>
                      {busy ? "正在准备…" : primaryLabel}
                    </Text>
                  </Pressy>
                </>
              )}
            </View>
          ) : null}
        </KeyboardViewport>
        <EdgeModal
          visible={!!preview}
          transparent
          animationType="fade"
          onRequestClose={() => setPreview(undefined)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: colors.canvas,
              paddingTop: 8 + insets.top,
              paddingBottom: 8 + insets.bottom,
            }}
          >
            <View style={{ alignItems: "flex-end", paddingHorizontal: 16 }}>
              <Pressy
                accessibilityLabel="关闭截图"
                onPress={() => setPreview(undefined)}
                style={{ width: 44, height: 44, alignItems: "center" }}
              >
                <PixelIcon name="close" size={22} color={colors.ink1} />
              </Pressy>
            </View>
            {preview ? (
              <AppImage
                source={{ uri: preview }}
                style={{ flex: 1 }}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </EdgeModal>
      </Screen>
    </ScreenEdge>
  );
}
const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    screen: { flex: 1, backgroundColor: t.canvas },
    content: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 12,
      gap: 8,
    },
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 4,
    },
    mark: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: t.orchidTint,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    title: { fontSize: 23, lineHeight: 30, color: t.ink1, fontWeight: "700" },
    tags: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 8,
    },
    tag: {
      color: t.ink2,
      backgroundColor: t.inset,
      fontSize: 10,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      overflow: "hidden",
    },
    official: {
      color: t.orchidText,
      backgroundColor: t.orchidTint,
      fontSize: 10,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      overflow: "hidden",
    },
    caption: { color: t.ink3, fontSize: 11, lineHeight: 17 },
    copy: { color: t.ink2, fontSize: 14, lineHeight: 22 },
    subtitle: {
      color: t.ink1,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
    },
    author: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
    },
    authorIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
      minWidth: 0,
    },
    description: { paddingBottom: 4 },
    facts: {
      flexDirection: "row",
      gap: 12,
      borderTopWidth: 0.5,
      borderBottomWidth: 0.5,
      borderColor: t.line,
      paddingVertical: 8,
    },
    fact: { flex: 1, gap: 4 },
    factValue: { color: t.ink1, fontSize: 12, lineHeight: 18 },
    tools: { flexDirection: "row", gap: 8 },
    tool: {
      flex: 1,
      minWidth: 0,
      minHeight: 52,
      borderRadius: 12,
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
    },
    toolText: { fontSize: 12, lineHeight: 18, textAlign: "center" },
    gallery: { gap: 8 },
    galleryImage: {
      width: 126,
      height: 210,
      borderRadius: 12,
      backgroundColor: t.inset,
    },
    line: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    management: {
      backgroundColor: t.surface,
      borderWidth: 0.5,
      borderColor: t.line,
      borderRadius: 14,
      padding: 12,
      gap: 12,
    },
    versionLine: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    managementActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    managementAction: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    marketPrimary: {
      minHeight: 44,
      borderRadius: 10,
      backgroundColor: t.accent,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    fieldGroup: { gap: 8 },
    input: {
      color: t.ink1,
      backgroundColor: t.surface,
      borderWidth: 0.5,
      borderColor: t.lineStrong,
      padding: 12,
      borderRadius: 12,
      minHeight: 48,
      fontSize: 14,
    },
    categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      minHeight: 44,
      borderRadius: 10,
      paddingHorizontal: 14,
      alignItems: "center",
    },
    editShot: { width: 88, position: "relative" },
    editImage: {
      width: 88,
      height: 140,
      borderRadius: 10,
      backgroundColor: t.inset,
    },
    removeShot: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 44,
      height: 44,
      alignItems: "center",
      borderRadius: 10,
      backgroundColor: t.redTint,
    },
    addShot: {
      width: 88,
      height: 140,
      borderWidth: 0.5,
      borderColor: t.lineStrong,
      borderRadius: 10,
      backgroundColor: t.orchidTint,
      alignItems: "center",
      gap: 10,
    },
    note: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: t.inset,
    },
    error: { color: t.redText, fontSize: 12, lineHeight: 18 },
    retry: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      justifyContent: "flex-start",
    },
    dock: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
      flexDirection: "row",
      gap: 8,
      backgroundColor: t.canvas,
    },
    primary: {
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: t.accent,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryText: {
      color: t.onAccent,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
    },
    updateButton: {
      minWidth: 64,
      minHeight: 48,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: t.orchidTint,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    empty: { padding: 24, gap: 16, alignItems: "center" },
  };
});
