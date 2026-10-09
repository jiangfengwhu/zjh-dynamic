import { AnimatedFlashList } from "./AnimatedFlashList";
import { afterInteractions, waitForInteractions } from "./interactionWork";
import { cachedPage, pageCacheKey } from "./pageCache";
import { ApplicationIcon, rememberApplicationIcon } from "./ApplicationIcon";
import { useLiveVersion } from "./liveEvents";
import { UserAvatar } from "./UserAvatar";
import { EmptyState } from "./EmptyState";
import { dataChanged } from "./pageCache";
import { ActivityIndicator } from "react-native";
import { HostAlert as Alert } from "./HostAlert";
import {
  currentAccountId,
  requireAccount,
  useAccount,
  uploadMarketScreenshot,
} from "./account";
import { openCreationComposer } from "./creationComposer";
import { useEffect, useRef, useState } from "react";
import { Share, View } from "react-native";
import { createShareText } from "./clipboardShares";
import {
  KeyboardAwareScrollView as ScrollView,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useIsFocused, usePreventRemove } from "@react-navigation/native";
import { MediaPicker as ImagePicker } from "../../../../packages/ui/media/MediaPicker";
import { AppImage } from "../../../../packages/ui/media/AppImage";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
import { FormField as TextInput } from "./FormField";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EdgeModal, Screen, ScreenEdge } from "../../../../packages/ui/edge";
import { ThemeContext, createThemedStyles, useTheme } from "../../../../packages/ui/theme";
import { loadCatalog, subscribeCatalog } from "./catalog";
import {
  readShellValue,
  readShellValueSync,
  writeShellValue,
  removeShellValue,
} from "./shellStorage";
import {
  offerApplication,
  applyApplicationUpdate,
  runningApplication,
  type ApplicationManifest,
} from "../runtime/applications";

import {
  fetchMarketDetail,
  isApplicationInstalledSync,
  cachedSharingSync,
  editMarketApplication,
  withdrawMarketApplication,
  shareMarketApplication,
  installMarketApplication,
  uninstallMarketApplication,
  marketCategories,
  type MarketApplication,
  type SharingState,
} from "./market";
import { HostText as Text } from "./feed/HostText";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";

import { KeyboardViewport } from "./KeyboardViewport";
import { useRouteRequestReady } from "./useRouteContentReady";
const bootstrap = require("../../../../tools/applications/bootstrap.json");
export function MarketPublicationScreen(props: Parameters<typeof MarketDetailContent>[0]) { return <MarketDetailScreen {...props} publication />; }
export function MarketDetailScreen(
  props: Parameters<typeof MarketDetailContent>[0]
) {
  const { user } = useAccount();
  const workVersion = useLiveVersion("work", props.item.manifest.appId);
  const ready = useRouteRequestReady();
  const focused = useIsFocused();
  const [result, setResult] = useState(() => ({ owner: user?.id, item: cachedPage<MarketApplication>(pageCacheKey(`market-detail:${props.item.manifest.appId}`)) ?? props.item }));
  const item = result.owner === user?.id ? result.item : props.item;
  const setItem = (next: MarketApplication) => setResult({ owner: user?.id, item: next });
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ready || !focused) return;
    if (props.item.detailOwner === (user?.id ?? "guest") && Date.now() - (props.item.detailAt ?? 0) < 1000 && !attempt) { setItem(props.item); return; }
    let live = true;
    void fetchMarketDetail(props.item.manifest.appId).then(async next => {
      await waitForInteractions();
      if (!live) return;
      setError(false);
      if (dataChanged(item, next, ["latest", "detailAt", "detailOwner"])) setItem(next);
    }, () => { if (live) setError(true); });
    return () => { live = false; };
  }, [ready, focused, props.item.manifest.appId, props.item, attempt, user?.id, workVersion]);
  // Lists can carry a display-only projection. Actions wait for full detail.
  return <View style={{ flex: 1 }}><LoadedMarketDetail {...props} item={item} onRefresh={() => setAttempt(value => value + 1)} />{error ? <Pressy accessibilityRole="button" accessibilityLabel="重试作品同步" onPress={() => { setError(false); setAttempt(value => value + 1); }}><Text>同步未完成 · 重试</Text></Pressy> : null}</View>;
}
function LoadedMarketDetail(props: Parameters<typeof MarketDetailContent>[0]) {
  const theme = useTheme();
  return (
    <ThemeContext.Provider value={theme}>
      <MarketDetailContent key={props.item.manifest.appId} {...props} />
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
  onRefresh,
}: {
  onRefresh?: () => void;
  onModify: (
    manifest: ApplicationManifest,
    ownerId: string,
    fork: boolean
  ) => void;
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
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const { user } = useAccount();
  const { colors } = useTheme();
  const app = item.manifest;
  const contentReady = useRouteRequestReady();
  const focused = useIsFocused() && contentReady;
  const [installed, setInstalled] = useState(() => isApplicationInstalledSync(app.appId));
  const [release, setRelease] = useState(() => { try { return JSON.parse(readShellValueSync(`application.pending.${app.appId}`) || readShellValueSync(`application.install.${app.appId}`) || "null")?.releaseId ?? ""; } catch { return ""; } });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [localReady, setLocalReady] = useState(true);
  const knownOwner = user?.id && item.authorId === user.id && item.owned !== false ? user.id : undefined;
  const initialSharing = knownOwner ? item.sharing ?? cachedSharingSync(app.appId) : undefined;
  const [ownershipReady, setOwnershipReady] = useState(true);
  const [ownerAccount, setOwnerAccount] = useState<string | undefined>(knownOwner);
  const owner = !!user && item.authorId === user.id && (item.owned ?? ownerAccount === user.id);
  const [localSharing, setLocalSharing] = useState<SharingState | undefined>(initialSharing);
  const sharingSource = useRef(item.sharing);
  const sharing = sharingSource.current === item.sharing ? localSharing : item.sharing;
  const sharingReady = !!sharing;
  function setSharing(next: SharingState | undefined) { sharingSource.current = item.sharing; setLocalSharing(next); }
  const [shareNotice, setShareNotice] = useState("");
  const [draftOwner, setDraftOwner] = useState<string>();
  const draftKey = `market.edit-draft.${draftOwner}.${app.appId}`;
  const [publishLatest, setPublishLatest] = useState(false);
  const [baseline, setBaseline] = useState("");
  const initializedOwner = useRef<string | undefined>(undefined);
  const pendingDraft = useRef<{ key: string; value: string } | undefined>(undefined);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [shareTitle, setShareTitle] = useState(item.title || app.appName);
  const [shareSummary, setShareSummary] = useState(item.summary || app.description);
  const [shareCategory, setShareCategory] = useState(item.category || "other");
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");
  const [manualIcon, setManualIcon] = useState<string>();
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
  useEffect(() => {
    if (saved && !busy && publication) onBack();
  }, [saved, busy, publication, onBack]);
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  const mutation = useRef(false);
  function modify() {
    if (item.summaryOnly) return;
    const ownerId = user?.id;
    if (!ownerId) { void requireAccount(); return; }
    const manifest =
      (installed ? runningApplication(app.appId) : undefined) ??
      (owner ? sharing?.application : undefined) ?? app;
    onModify(manifest, ownerId, !owner);
  }
  useEffect(() => {
    if (!contentReady) return;
    let live = true;
    let localRevision = 0;
    const update = async (entries: Awaited<ReturnType<typeof loadCatalog>>) => {
      const revision = ++localRevision;
      const raw =
        (await readShellValue(`application.pending.${app.appId}`)) ||
        (await readShellValue(`application.install.${app.appId}`));
      if (!live || revision !== localRevision) return;
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
    const initialRevision = localRevision;
    void loadCatalog()
      .then(entries => { if (localRevision === initialRevision) return update(entries); })
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
      const accountId = user?.id;
      const owned = !!accountId && item.authorId === accountId && item.owned !== false;
      if (!live) return;
      setOwnerAccount(owned ? accountId : undefined); setOwnershipReady(true);
      if (!owned) { setSharing(undefined); setDraftOwner(undefined); initializedOwner.current = undefined; return; }
      const state = item.sharing;
      if (!state) return;
      try {
        if (live) {
          if (publication && initializedOwner.current !== accountId) {
            let draft: {
              title?: string;
              summary?: string;
              category?: string;
              screenshots?: string[];
              publishLatest?: boolean;
              releaseId?: string;
            } | null = null;
            try {
              draft = JSON.parse(
                (await readShellValue(
                  `market.edit-draft.${accountId}.${app.appId}`
                )) || "null"
              );
            } catch {
              /* Start from the market information. */
            }
            if (!live) return;
            const fields = {
              title:
                state.shared?.title ||
                state.application?.appName ||
                item.title ||
                app.appName,
              summary:
                state.shared?.summary ??
                state.application?.description ??
                item.summary ??
                app.description,
              category: state.shared?.category || item.category || "other",
              screenshots: state.shared?.screenshots || item.screenshots || [],
            };
            setBaseline(JSON.stringify(fields));
            setShareTitle(
              typeof draft?.title === "string"
                ? draft.title.slice(0, 60)
                : fields.title
            );
            setShareSummary(
              typeof draft?.summary === "string"
                ? draft.summary.slice(0, 300)
                : fields.summary
            );
            setShareCategory(
              marketCategories.some(
                (category) => category.id && category.id === draft?.category
              )
                ? draft!.category!
                : fields.category
            );
            setScreenshots(
              Array.isArray(draft?.screenshots)
                ? draft.screenshots
                    .filter(
                      (url) =>
                        typeof url === "string" && url.startsWith("https://")
                    )
                    .slice(0, 6)
                : fields.screenshots
            );
            setPublishLatest(
              !state.shared ||
                Boolean(
                  state.application &&
                    state.shared.manifest.releaseId !==
                      state.application.releaseId &&
                    draft?.publishLatest &&
                    draft.releaseId === state.application.releaseId
                )
            );
            initializedOwner.current = accountId;
            setDraftOwner(accountId);
          }
          if (!live) return;
          setSharing(state);
          setShareNotice("");
        }
      } catch {
        if (live) setShareNotice("分享状态暂未接回，请稍后重新打开详情。");
      }
    }
    const cancel = afterInteractions(() => {
      void refresh().catch(() => {
        if (live) {
          setOwnershipReady(true);
          setShareNotice("作品状态暂未同步，请重试");
        }
      });
    });
    return () => {
      live = false;
      cancel();
    };
  }, [app.appId, focused, user?.id, publication, item.sharing, item.owned]);
  const formValue = JSON.stringify({
    title: shareTitle,
    summary: shareSummary,
    category: shareCategory,
    screenshots,
  });
  const formDirty = formValue !== baseline;
  const formReady = publication && owner && draftOwner === user?.id;
  useEffect(() => {
    if (!formReady || !sharingReady) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    if (!formDirty && publishLatest === !sharing?.shared) {
      pendingDraft.current = undefined;
      removeShellValue(draftKey);
      return;
    }
    const snapshot = {
      key: draftKey,
      value: JSON.stringify({
        ...JSON.parse(formValue),
        publishLatest,
        releaseId: sharing?.application?.releaseId,
      }),
    };
    pendingDraft.current = snapshot;
    draftTimer.current = setTimeout(
      () => writeShellValue(snapshot.key, snapshot.value),
      180
    );
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [
    formReady,
    sharingReady,
    formValue,
    formDirty,
    publishLatest,
    sharing?.shared,
    sharing?.application?.releaseId,
    draftKey,
  ]);
  useEffect(
    () => () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
      const snapshot = pendingDraft.current;
      if (snapshot) writeShellValue(snapshot.key, snapshot.value);
      pendingDraft.current = undefined;
    },
    [app.appId, user?.id]
  );
  function discardSavedDraft() {
    if (draftTimer.current) clearTimeout(draftTimer.current);
    pendingDraft.current = undefined;
    removeShellValue(draftKey);
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
  async function uploadIcon() {
    if (!owner || mutation.current) return;
    mutation.current = true; setBusy(true); setError("");
    let path: string | undefined;
    try {
      const accountId = await currentAccountId();
      const image = await ImagePicker.openPicker({
        mediaType: "photo", cropping: true, width: 512, height: 512, forceJpg: true,
        compressImageMaxWidth: 512, compressImageMaxHeight: 512, compressImageQuality: 0.8,
        cropperToolbarTitle: "裁剪应用图标", cropperChooseText: "使用", cropperCancelText: "取消",
      });
      path = image.path;
      if (image.size > 256 * 1024) throw new Error("图标压缩后仍超过 256 KB，请选择较简单的图片");
      if (!alive.current || (await currentAccountId()) !== accountId) return;
      setUploadStatus("正在上传图标…");
      const url = await uploadMarketScreenshot(app.appId, image.path, true);
      if (!alive.current || (await currentAccountId()) !== accountId) return;
      rememberApplicationIcon(app.appId, url);
      setManualIcon(url);
      setSharing(previous => previous ? { ...previous, iconUrl: url, shared: previous.shared ? { ...previous.shared, iconUrl: url } : null } : previous);
      Toast.show({ type: "success", text1: "图标已更新" });
    } catch (cause) {
      if ((cause as { code?: string }).code !== "E_PICKER_CANCELLED" && alive.current) Toast.show({ type: "error", text1: cause instanceof Error ? cause.message : "图标上传失败，请重试" });
    } finally {
      if (path) void ImagePicker.cleanSingle(path).catch(() => {});
      mutation.current = false;
      if (alive.current) { setBusy(false); setUploadStatus(""); }
    }
  }
  async function save() {
    if (mutation.current || !sharingReady || !formReady || !shareTitle.trim())
      return;
    const mode = sharing?.shared && !publishLatest ? "edit" : "share";
    if (mode === "share" && !sharing?.application) return;
    mutation.current = true;
    setBusy(true);
    setError("");
    try {
      const state =
        mode === "edit"
          ? await editMarketApplication(
              app.appId,
              shareTitle,
              shareSummary,
              shareCategory,
              screenshots
            )
          : await shareMarketApplication(
              app.appId,
              sharing!.application!.releaseId,
              shareTitle,
              shareSummary,
              shareCategory,
              screenshots
            );
      Toast.show({
        type: "success",
        text1: mode === "edit" ? "作品介绍已保存" : "作品已公开",
      });
      discardSavedDraft();
      setBaseline(formValue);
      setSharing(state);
      setPublishLatest(false);
      setSaved(true);
      setShareNotice(
        mode === "edit"
          ? "分享信息已保存，公开版本保持不变。"
          : "已公开选定版本，大家可以发现并体验它。"
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
        setPublishLatest(true);
        setBaseline("");
        setShareNotice("已撤回公开，填写的信息仍保留，可以再次公开。");
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
    if (item.summaryOnly) return;
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
    displayed.bundle && displayed.assets ? displayed.bundle.bytes +
    displayed.assets.reduce((total, asset) => total + asset.bytes, 0) : undefined;
  function continueCreation() {
    openCreationComposer({
      appId: app.appId,
      title: app.appName,
      releaseId: app.releaseId,
      fork: !owner,
    });
  }
  const summary = (shared?.summary ?? item.summary ?? app.description ?? "").trim();
  function renderIcon(size = 76) {
    const style = [styles.mark, { width: size, height: size, borderRadius: size * 0.27 }];
    const content = <>
      <ApplicationIcon application={{ ...item, manifest: displayed, iconUrl: manualIcon || sharing?.iconUrl || shared?.iconUrl || item.iconUrl }} size={size} />
      {uploadStatus === "正在上传图标…" ? <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.surface, opacity: 0.85, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.accentText} /></View> : null}
    </>;
    return owner ? <Pressy accessibilityRole="button" accessibilityLabel="更换应用图标" accessibilityHint="选择图片并裁剪" disabled={!!item.summaryOnly || busy} onPress={() => void uploadIcon()} style={style}>{content}</Pressy> : <View style={style}>{content}</View>;
  }
  const publicationStatus = (
    <View
      style={[
        styles.publicationStatus,
        { backgroundColor: shared ? colors.greenTint : colors.accentTint },
      ]}
    >
      <View style={styles.line}>
        {renderIcon(44)}
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={1} style={styles.subtitle}>
            {app.appName}
          </Text>
          <Text
            style={[
              styles.caption,
              { color: shared ? colors.greenText : colors.accentText },
            ]}
          >
            {shared
              ? "已公开 · 大家可以发现并体验它"
              : sharing?.application
              ? "未公开 · 完成介绍后即可公开"
              : "未公开 · 完成制作后即可公开"}
          </Text>
        </View>
        <SymbolIcon
          name={shared ? "check" : "send"}
          size={20}
          color={shared ? colors.greenText : colors.accentText}
        />
      </View>
      <View style={styles.versionLine}>
        {shared ? (
          <Text style={styles.caption}>
            公开 v{versionName(shared.manifest)}
          </Text>
        ) : null}
        {sharing?.application ? (
          <Text style={styles.caption}>制作 v{versionName(latest)}</Text>
        ) : null}
      </View>
      {shared && hasNewVersion ? (
        <View style={styles.versionChoices}>
          {[
            { value: false, label: "保留公开版本" },
            { value: true, label: "发布制作新版" },
          ].map((option) => (
            <Pressy
              key={String(option.value)}
              disabled={!!item.summaryOnly || busy || !sharingReady}
              accessibilityState={{ selected: publishLatest === option.value }}
              onPress={() => setPublishLatest(option.value)}
              style={[
                styles.versionChoice,
                {
                  backgroundColor:
                    publishLatest === option.value
                      ? colors.ink1
                      : colors.surface,
                  borderColor:
                    publishLatest === option.value
                      ? colors.ink1
                      : colors.line,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  fontWeight: publishLatest === option.value ? "700" : "500",
                  color:
                    publishLatest === option.value
                      ? colors.onAccent
                      : colors.ink2,
                }}
              >
                {option.label}
              </Text>
              {publishLatest === option.value ? (
                <SymbolIcon name="check" size={13} color={colors.onAccent} />
              ) : null}
            </Pressy>
          ))}
        </View>
      ) : null}
      <Text style={styles.caption}>
        {shared && !publishLatest
          ? "保存介绍不会替换当前公开的应用版本。"
          : "本次公开制作版本，之后制作的新版需要再次发布。"}
      </Text>
    </View>
  );
  const publicationFallback = (
    <View style={styles.note}>
      {!ownershipReady || (owner && !shareNotice) ? (
        <ActivityIndicator color={colors.accentText} />
      ) : (
        <SymbolIcon name="mine" size={20} color={colors.accentText} />
      )}
      <Text style={[styles.copy, { flex: 1 }]}>
        {!ownershipReady
          ? "正在读取作者权限…"
          : shareNotice ||
            (owner ? "正在准备作品介绍…" : "仅作品作者可管理公开状态。")}
      </Text>
      {shareNotice ? (
        <Pressy
          disabled={!!item.summaryOnly || busy}
          onPress={onRefresh}
          accessibilityLabel="重新读取作品介绍"
        >
          <SymbolIcon name="refresh" size={18} color={colors.accentText} />
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
        <PageHeader title="作品详情" onBack={onBack} />
        <EmptyState style={styles.empty}>
          <SymbolIcon name="mine" size={32} color={colors.accentText} />
          <Text style={styles.copy}>请登录作品所属账号后查看。</Text>
          <Pressy onPress={() => void requireAccount()} style={styles.primary}>
            <Text style={styles.primaryText}>登录</Text>
          </Pressy>
        </EmptyState>
      </Screen>
    );
  return (
    <ScreenEdge bottom={false}>
      <Screen style={styles.screen}>
        <PageHeader
          title={
            publication
              ? "公开作品"
              : ownsSurface
              ? "作品详情"
              : "应用详情"
          }
          onBack={onBack}
          right={
            publication && owner && shared ? (
              <Pressy
                disabled={!!item.summaryOnly || busy || !sharingReady}
                onPress={withdraw}
                accessibilityLabel="撤回公开"
                scale={1}
                hitSlop={6}
                style={{
                  width: 36,
                  height: 36,
                  minWidth: 36,
                  minHeight: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  backgroundColor: colors.redTint,
                }}
              >
                <SymbolIcon name="close" size={18} color={colors.redText} />
              </Pressy>
            ) : !publication && owner && onPublication ? (
              <Pressy
                accessibilityLabel="公开作品"
                onPress={onPublication}
                scale={1}
                hitSlop={6}
                style={{ width: 36, height: 36, minWidth: 36, minHeight: 36, borderRadius: 18, alignItems: "center", backgroundColor: colors.accent, paddingHorizontal: 0, paddingVertical: 0 }}
              >
                <SymbolIcon name="send" size={17} strokeWidth={2.2} color={colors.onAccent} />
              </Pressy>
            ) : undefined
          }
        />
        <KeyboardViewport>
          <ScrollView
            ref={scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bottomOffset={24}
            contentContainerStyle={styles.content}
          >
            {publication ? (
              formReady ? (
                <>
                  {publicationStatus}
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
                        { height: 92, textAlignVertical: "top" },
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
                            disabled={!!item.summaryOnly || busy}
                            accessibilityState={{
                              selected: shareCategory === category.id,
                            }}
                            onPress={() => setShareCategory(category.id)}
                            style={[
                              styles.chip,
                              {
                                backgroundColor:
                                  shareCategory === category.id
                                    ? colors.ink1
                                    : colors.surface,
                                borderColor:
                                  shareCategory === category.id
                                    ? colors.ink1
                                    : colors.line,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                color:
                                  shareCategory === category.id
                                    ? colors.canvas
                                    : colors.ink2,
                                fontSize: 13,
                                fontWeight: shareCategory === category.id ? "700" : "500",
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
                    <AnimatedFlashList horizontal data={screenshots} keyExtractor={url => url} extraData={busy} maintainVisibleContentPosition={{ disabled: true }} showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ height: 144 }} contentContainerStyle={{ paddingVertical: 2 }} ItemSeparatorComponent={() => <View style={{ width: 8 }} />} renderItem={({ item: url, index }) => (
                        <View style={styles.editShot}>
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
                            disabled={!!item.summaryOnly || busy}
                            onPress={() =>
                              setScreenshots((previous) =>
                                previous.filter((value) => value !== url)
                              )
                            }
                            accessibilityLabel={`移除截图 ${index + 1}`}
                            style={styles.removeShot}
                          >
                            <SymbolIcon
                              name="close"
                              size={16}
                              color={colors.redText}
                            />
                          </Pressy>
                        </View>
                    )} ListFooterComponent={<View style={{ paddingLeft: screenshots.length ? 8 : 0 }}>
                      {screenshots.length < 6 ? (
                        <Pressy
                          disabled={!!item.summaryOnly || busy}
                          onPress={() => void chooseScreenshots()}
                          accessibilityLabel="添加截图"
                          style={styles.addShot}
                        >
                          <SymbolIcon
                            name="photo"
                            size={24}
                            color={colors.accentText}
                          />
                          <Text
                            style={{ color: colors.accentText, fontSize: 11 }}
                          >
                            添加截图
                          </Text>
                        </Pressy>
                      ) : null}
                    </View>} />
                    <Text style={styles.caption}>
                      上传真实的使用画面，第一张用于搜索和详情预览。
                    </Text>
                  </View>
                  {uploadStatus ? (
                    <View style={styles.note}>
                      <ActivityIndicator color={colors.accentText} />
                      <Text
                        accessibilityLiveRegion="polite"
                        style={styles.caption}
                      >
                        {uploadStatus}
                      </Text>
                    </View>
                  ) : null}
                  {shareNotice ? (
                    <Text
                      accessibilityLiveRegion="polite"
                      style={styles.caption}
                    >
                      {shareNotice}
                    </Text>
                  ) : null}
                  {!sharingReady ? publicationFallback : null}
                </>
              ) : (
                publicationFallback
              )
            ) : (
              <>
                <View style={styles.hero}>
                  {renderIcon()}
                  <View style={{ flex: 1, minWidth: 0, minHeight: 64, justifyContent: "space-between", gap: 6 }}>
                    <Text
                      style={styles.title}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {shared?.title || item.title || app.appName}
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
                    <AnimatedFlashList horizontal data={gallery} keyExtractor={url => url} maintainVisibleContentPosition={{ disabled: true }} showsHorizontalScrollIndicator={false} style={{ height: 213 }} ItemSeparatorComponent={() => <View style={{ width: 10 }} />} renderItem={({ item: url, index }) => (
                        <Pressy
                          scale={1}
                          accessibilityLabel={`查看截图 ${index + 1}`}
                          onPress={() => setPreview(url)}
                        >
                          <AppImage
                            source={{ uri: url }}
                            style={styles.galleryImage}
                            resizeMode="contain"
                          />
                        </Pressy>
                    )} />
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
                    <UserAvatar uri={authorAvatar} authorId={authorId} size={24} />
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
                  <SymbolIcon name="arrow" size={16} color={colors.ink3} />
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
                      {bytes === undefined ? "加载中…" : bytes >= 1048576
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
                {typeof (ownsSurface ? latest : app).releaseNotes ===
                  "string" &&
                (ownsSurface ? latest : app).releaseNotes?.trim() ? (
                  <View style={styles.description}>
                    <Text style={styles.subtitle}>更新日志 · {versionName(ownsSurface ? latest : app)}</Text>
                    <Text style={styles.copy}>
                      {(ownsSurface ? latest : app).releaseNotes}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.tools}>
                  <Pressy
                    disabled={
                      !!item.summaryOnly || busy ||
                      !ownershipReady ||
                      app.appId === bootstrap.defaultApplication
                    }
                    onPress={() => (owner ? void modify() : continueCreation())}
                    style={styles.tool}
                  >
                    <SymbolIcon
                      name={owner ? "edit" : "spark"}
                      size={18}
                      strokeWidth={2.1}
                      color={colors.accent}
                    />
                    <Text style={[styles.toolText, { color: colors.ink1 }]}>
                      {owner ? "修改" : "Remix"}
                    </Text>
                  </Pressy>
                  <Pressy
                    disabled={!!item.summaryOnly || busy || (ownsSurface && (!shared || !canManage))}
                    accessibilityLabel={
                      ownsSurface && !shared
                        ? "分享，公开作品后可用"
                        : "分享作品"
                    }
                    onPress={() => Alert.alert("分享作品", "选择分享方式", [
                      { text: "分享到动态", onPress: () => onSharePost(shared ?? item) },
                      { text: "分享链接", onPress: () => {
                        const message = createShareText({ kind: "application", id: app.appId }, shared?.title || item.title || app.appName);
                        void Share.share({ title: shared?.title || item.title || app.appName, message }).catch(() => Toast.show({ type: "error", text1: "分享未完成，请重试" }));
                      } },
                      { text: "取消", style: "cancel" },
                    ])}
                    style={styles.tool}
                  >
                    <SymbolIcon
                      name="share"
                      size={18}
                      strokeWidth={2.1}
                      color={colors.cyan}
                    />
                    <Text
                      style={[styles.toolText, { color: colors.ink1 }]}
                    >
                      分享
                    </Text>
                  </Pressy>
                  <Pressy
                    disabled={
                      !!item.summaryOnly || busy ||
                      !installed ||
                      app.appId === bootstrap.defaultApplication
                    }
                    onPress={uninstall}
                    style={styles.tool}
                  >
                    <SymbolIcon name="close" size={18} strokeWidth={2.1} color={colors.redText} />
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
                <SymbolIcon name="alert" size={18} color={colors.redText} />
                <Text style={[styles.error, { flex: 1 }]}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>
          {!publication || formReady ? (
            <View style={styles.dock}>
              {publication ? (
                <Pressy
                  disabled={
                    !!item.summaryOnly || busy ||
                    !canManage ||
                    !shareTitle.trim() ||
                    (!shared && !sharing?.application) ||
                    (Boolean(shared) &&
                      publishLatest &&
                      !sharing?.application) ||
                    (Boolean(shared) && !publishLatest && !formDirty)
                  }
                  onPress={() => void save()}
                  style={[styles.primary, { flex: 1 }]}
                >
                  {busy ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <SymbolIcon name="check" size={18} color={colors.onAccent} />
                  )}
                  <Text style={styles.primaryText}>
                    {busy
                      ? uploadStatus
                        ? "正在上传截图…"
                        : "正在保存…"
                      : !shared && !sharing?.application
                      ? "完成制作后可公开"
                      : !shared
                      ? "公开作品"
                      : publishLatest
                      ? "发布新版并保存信息"
                      : formDirty
                      ? "保存作品介绍"
                      : "信息已保存"}
                  </Text>
                </Pressy>
              ) : (
                <>
                  {installed && update ? (
                    <Pressy
                      accessibilityLabel="更新应用"
                      disabled={!!item.summaryOnly || busy}
                      onPress={() => void install()}
                      style={styles.updateButton}
                    >
                      <SymbolIcon
                        name="refresh"
                        size={18}
                        color={colors.accentText}
                      />
                      <Text style={{ color: colors.accentText, fontSize: 14, fontWeight: "700" }}>
                        更新
                      </Text>
                    </Pressy>
                  ) : null}
                  <Pressy
                    disabled={
                      !!item.summaryOnly || busy ||
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
                      <SymbolIcon name="box" size={18} color={colors.onAccent} />
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
                <SymbolIcon name="close" size={22} color={colors.ink1} />
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
const useStyles = createThemedStyles((base) => {
  const t = base;
  return {
    screen: { flex: 1, backgroundColor: t.canvas },
    content: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 16,
      gap: 12,
    },
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 4,
    },
    mark: {
      width: 76,
      height: 76,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderWidth: t.components.surfaceBorder,
      borderColor: t.line,
    },
    title: { ...t.type.title1, color: t.ink1 },
    tags: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
    },
    tag: {
      color: t.ink2,
      backgroundColor: t.surfaceRaised,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "600",
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 10,
      overflow: "hidden",
    },
    official: {
      color: t.orchidText,
      backgroundColor: t.orchidTint,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 10,
      overflow: "hidden",
    },
    caption: { color: t.ink3, fontSize: 12, lineHeight: 17 },
    copy: { color: t.ink2, fontSize: 14, lineHeight: 21 },
    subtitle: {
      color: t.ink1,
      ...t.type.headline,
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
      backgroundColor: t.surface,
      borderRadius: t.radius.xl,
      borderWidth: t.mode === "dark" ? t.components.surfaceBorder : 0,
      borderColor: t.line,
      boxShadow: t.shadow.card,
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    fact: { flex: 1, gap: 2 },
    factValue: { color: t.ink1, fontSize: 15, lineHeight: 20, fontWeight: "800", letterSpacing: -0.3 },
    tools: { flexDirection: "row", gap: 8 },
    tool: {
      flex: 1,
      minWidth: 0,
      minHeight: 60,
      borderRadius: t.radius.xl,
      backgroundColor: t.surface,
      borderWidth: t.mode === "dark" ? t.components.surfaceBorder : 0,
      borderColor: t.line,
      boxShadow: t.shadow.card,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingVertical: 8,
    },
    toolText: { fontSize: 12, lineHeight: 16, fontWeight: "700", textAlign: "center" },
    gallery: { gap: 8 },
    galleryImage: {
      width: 120,
      height: 213,
      borderRadius: t.radius.xl,
      backgroundColor: t.surfaceRaised,
    },
    line: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    publicationStatus: {
      borderRadius: t.radius.lg,
      padding: 14,
      gap: 8,
      borderWidth: 0,
      borderColor: t.line,
    },
    versionLine: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    versionChoices: { flexDirection: "row", gap: 8 },
    versionChoice: {
      flex: 1,
      minWidth: 0,
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: 19,
      borderWidth: t.components.surfaceBorder,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    fieldGroup: { gap: 8, paddingTop: 6 },
    input: {
      color: t.ink1,
      backgroundColor: t.surfaceRaised,
      borderWidth: 0,
      borderColor: t.line,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: t.radius.md,
      minHeight: 44,
      fontSize: 14,
    },
    categories: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      minHeight: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: t.components.surfaceBorder,
      paddingHorizontal: 12,
      paddingVertical: 0,
      alignItems: "center",
    },
    editShot: { width: 88, position: "relative" },
    editImage: {
      width: 88,
      height: 140,
      borderRadius: t.radius.md,
      backgroundColor: t.surfaceRaised,
    },
    removeShot: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 32,
      height: 32,
      minWidth: 32,
      minHeight: 32,
      alignItems: "center",
      borderRadius: 16,
      backgroundColor: t.redTint,
    },
    addShot: {
      width: 88,
      height: 140,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: t.lineStrong,
      borderRadius: t.radius.md,
      backgroundColor: t.surface,
      alignItems: "center",
      gap: 10,
    },
    note: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: t.radius.lg,
      backgroundColor: t.surfaceRaised,
    },
    error: { color: t.redText, fontSize: 12, lineHeight: 18 },
    dock: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 10,
      flexDirection: "row",
      gap: 10,
    },
    primary: {
      minHeight: 46,
      borderRadius: 23,
      backgroundColor: t.accent,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryText: {
      color: t.onAccent,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: "700",
    },
    updateButton: {
      minWidth: 76,
      minHeight: 46,
      paddingHorizontal: 16,
      borderRadius: 23,
      backgroundColor: t.surfaceRaised,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    empty: { padding: 20, gap: 12, alignItems: "center" },
  };
});
