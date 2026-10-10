import { useEventCallback } from "../useEventCallback";
import { normalizeShareParams } from "../../../../../packages/app-sdk/src/sharing";
import { appendUnique } from "../listData";
import { AnimatedFlashList } from "../AnimatedFlashList";
import { PageSkeleton } from "../LoadingSkeleton";
import { Text } from "../../../../../packages/ui/primitives/Typography";
import { UserAvatar } from "../UserAvatar";
import { EmptyState } from "../EmptyState";
import { ActivityIndicator } from "react-native";
import {
  useCallback,
  memo,
  useMemo,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { Keyboard, Pressable, ScrollView, Switch, View } from "react-native";
import { FormField as TextInput } from "../FormField";
import { SymbolIcon } from "../../../../../packages/ui/chrome/SymbolIcon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppImage } from "../../../../../packages/ui/media/AppImage";
import { MediaPicker as ImagePicker } from "../../../../../packages/ui/media/MediaPicker";
import { KeyboardViewport } from "../KeyboardViewport";
import { usePreventRemove } from "@react-navigation/native";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { PageHeader, Pressy } from "../../../../../packages/ui/chrome";
import { EdgeModal, Screen, ScreenEdge } from "../../../../../packages/ui/edge";
import { createThemedStyles, useTheme } from "../../../../../packages/ui/theme";
import {
  cachedAccountId,
  currentAccountId,
  uploadPostImage,
  useAccount,
} from "../account";
import { readShellValue, writeShellValue } from "../shellStorage";
import { publishUserPost } from "./userPosts";
import { fetchMarketPicker, fetchMarketDetail, type MarketApplication } from "../market";
import { ApplicationPostCard } from "./ApplicationPostCard";
import {
  retainDraftImage,
  removeDraftImage,
  existingDraftImages,
} from "../mediaDraft";

import { HtmlPostContent } from "./HtmlPostContent";
import { htmlByteLength } from "./postDraft";
import { polishPost } from "./polishPost";
import { applicationContext } from "../../../../../packages/app-sdk/src/runtime";
import type { UserPostDraft } from "../../../../../packages/app-sdk/src/index";


export type ComposePostControls = {
  canPublish: boolean;
  busy: boolean;
  submit: () => void;
};

type Photo = { path: string; id?: string; url?: string };
export const ComposePostScreen = memo(function ComposePostScreen({
  onBack,
  initialApplication,
  initialDraft,
  modeTabs,
  embedded = false,
  onControlsChange,
}: {
  onBack: () => void;
  initialApplication?: MarketApplication;
  initialDraft?: UserPostDraft;
  modeTabs?: import("react").ReactNode;
  embedded?: boolean;
  onControlsChange?: (controls: ComposePostControls) => void;
}) {
  const styles = useStyles();

  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAccount();
  const owner = useRef(cachedAccountId()).current;
  const [text, setText] = useState(
    initialDraft?.html ?? initialDraft?.body ??
      (initialApplication
        ? `分享《${
            initialApplication.title || initialApplication.manifest.appName
          }》，欢迎来体验。`
        : ""),
  );
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [status, setStatus] = useState("");
  const [application, setApplication] = useState<MarketApplication | undefined>(
    initialApplication,
  );
  const attachmentRevision = useRef(0);
  const [applicationParams, setApplicationParams] = useState(initialDraft?.application?.params);
  const [attachmentReady, setAttachmentReady] = useState(!initialDraft?.application);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentRetry, setAttachmentRetry] = useState(0);
  const [appsQuery, setAppsQuery] = useState("");
  const pickerQuery = useRef("");
  const [picking, setPicking] = useState(false);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsError, setAppsError] = useState("");
  const [appsCursor, setAppsCursor] = useState<string>();
  const [applications, setApplications] = useState<MarketApplication[]>([]);
  const [caption, setCaption] = useState(initialDraft?.html ? initialDraft.body ?? "" : "");
  const [htmlMode, setHtmlMode] = useState(!!initialDraft?.html);
  const [previewing, setPreviewing] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState("");
  const [beforePolish, setBeforePolish] = useState<string>();
  const polishController = useRef<AbortController | undefined>(undefined);
  const html = htmlMode ? text : "";
  const body = htmlMode ? caption : text;
  const previewHtml = useDeferredValue(html);
  const content =
    htmlMode && html.trim()
      ? { format: "html" as const, version: 1 as const, html }
      : undefined;
  const htmlBytes = htmlByteLength(html);
  const [published, setPublished] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = `social.application-draft.${owner}${
    initialDraft ? ".html-share" : ""
  }${initialApplication ? `.${initialApplication.manifest.appId}` : ""}`;
  const working = useRef(false);
  const alive = useRef(true);
  const files = useRef(new Set<string>());
  const revision = useRef(0);
  const request = useRef<{ signature: string; id: string } | undefined>(
    undefined,
  );
  const count = Array.from(body).length;
  const canPublish =
    draftReady && attachmentReady &&
    (text.trim().length > 0 ||
      photos.length > 0 ||
      !!application ||
      !!content) &&
    (!htmlMode || htmlBytes <= 32768) &&
    count <= 2000 &&
    !busy &&
    !choosing &&
    !picking;
  const publishRef = useRef(publish);
  publishRef.current = publish;
  const submit = useCallback(() => {
    void publishRef.current();
  }, []);
  useEffect(() => {
    onControlsChange?.({ canPublish, busy, submit });
  }, [canPublish, busy, submit, onControlsChange]);
  usePreventRemove(busy, () =>
    Toast.show({ type: "info", text1: "正在发布，请稍候" }),
  );
  useEffect(() => {
    if (published && !busy) onBack();
  }, [published, busy, onBack]);
  useEffect(() => {
    const target = initialDraft?.application;
    if (!target) return;
    const controller = new AbortController();
    const version = attachmentRevision.current;
    setAttachmentError("");
    void fetchMarketDetail(target.appId, { signal: controller.signal, immediate: true }).then(item => {
      if (controller.signal.aborted || version !== attachmentRevision.current) return;
      setApplication(item); setApplicationParams(normalizeShareParams(target.params)); setAttachmentReady(true);
    }).catch(error => { if (!controller.signal.aborted && version === attachmentRevision.current) setAttachmentError(error instanceof Error ? error.message : "应用读取失败"); });
    return () => controller.abort();
  }, [initialDraft?.application, attachmentRetry]);
  useEffect(() => {
    void (async () => {
      try {
        const value = owner ? await readShellValue(draftKey) : undefined;
        if (value && !initialDraft) {
          const draft = JSON.parse(value);
          const restored = await existingDraftImages<Photo>(
            Array.isArray(draft.photos) ? draft.photos : [],
          );
          if (
            alive.current &&
            !revision.current &&
            (await currentAccountId()) === owner
          ) {
            setText(typeof draft.editorText === "string" ? draft.editorText : draft.htmlMode && typeof draft.html === "string" ? draft.html : typeof draft.body === "string" ? draft.body : "");
            setCaption(typeof draft.caption === "string" ? draft.caption : draft.htmlMode && typeof draft.body === "string" ? draft.body : "");
            setApplication(
              draft.application?.manifest?.appId
                ? draft.application
                : initialApplication,
            );
            setApplicationParams(normalizeShareParams(draft.applicationParams));
            setPhotos(restored);
            setHtmlMode(!!draft.htmlMode);
          }
        }
      } catch {
        if (alive.current)
          Toast.show({ type: "error", text1: "草稿读取失败，请重试" });
      } finally {
        if (alive.current && (await currentAccountId()) === owner)
          setDraftReady(true);
      }
    })();
    return () => {
      alive.current = false;
      polishController.current?.abort();
      for (const path of files.current)
        void ImagePicker.cleanSingle(path).catch(() => {});
    };
  }, [owner, draftKey]);
  useEffect(() => {
    if (draftReady && owner && !published)
      writeShellValue(
        draftKey,
        JSON.stringify({ body, editorText: text, caption, application, applicationParams, photos, html, htmlMode }),
      );
  }, [
    draftReady,
    text,
    application,
    applicationParams,
    photos,
    html,
    htmlMode,
    caption,
    published,
    draftKey,
  ]);
  function saveDraft(body: string, selected?: MarketApplication) {
    revision.current++;
    if (owner && draftReady)
      writeShellValue(
        draftKey,
        JSON.stringify({ body: htmlMode ? caption : body, editorText: body, caption, application: selected, applicationParams: selected?.manifest.appId === application?.manifest.appId ? applicationParams : undefined, photos, html: htmlMode ? body : "", htmlMode }),
      );
  }
  function change(value: string) {
    polishController.current?.abort();
    setPolishing(false);
    setPolishError("");
    setBeforePolish(undefined);
    setText(value);
    saveDraft(value, application);
  }
  async function polish() {
    if (polishing || busy || !draftReady || !text.trim()) return;
    const source = text;
    const before = revision.current;
    const controller = new AbortController();
    polishController.current = controller;
    setPolishing(true);
    setPolishError("");
    try {
      const result = await polishPost(source, htmlMode ? "html" : "text", controller.signal);
      if (!alive.current || controller.signal.aborted || before !== revision.current || await currentAccountId() !== owner) return;
      setBeforePolish(source);
      setText(result);
      saveDraft(result, application);
    } catch (cause) {
      if (alive.current && !controller.signal.aborted && before === revision.current)
        setPolishError(cause instanceof Error ? cause.message : "润色未完成，原文已保留");
    } finally {
      if (polishController.current === controller) { polishController.current = undefined; if (alive.current) setPolishing(false); }
    }
  }
  function selectApplication(item?: MarketApplication) {
    attachmentRevision.current++;
    if (!item || item.manifest.appId !== application?.manifest.appId) setApplicationParams(undefined);
    setAttachmentReady(true); setAttachmentError("");
    setApplication(item);
    setPicking(false);
    saveDraft(text, item);
  }
  async function pickApplication(more = false, query = appsQuery) {
    if (working.current || loadingApps || !draftReady) return;
    Keyboard.dismiss();
    setPicking(true);
    setLoadingApps(true);
    setAppsError("");
    try {
      if (!more) { pickerQuery.current = query.trim(); setApplications([]); setAppsCursor(undefined); }
      const page = await fetchMarketPicker(more ? appsCursor : undefined, pickerQuery.current);
      const items = page.applications;
      if ((await currentAccountId()) !== owner)
        throw new Error("账号已改变，请重试");
      if (alive.current)
        { setAppsCursor(page.nextCursor); setApplications(previous => more ? appendUnique(previous, items, item => item.manifest.appId) : items); }
    } catch (error) {
      if (alive.current)
        setAppsError(
          error instanceof Error ? error.message : "应用列表暂时不可用",
        );
    } finally {
      if (alive.current) setLoadingApps(false);
    }
  }
  async function choose() {
    if (working.current || !draftReady || photos.length >= 4) return;
    working.current = true;
    setChoosing(true);
    try {
      const images = await ImagePicker.openPicker({
        mediaType: "photo",
        multiple: true,
        maxFiles: 4 - photos.length,
        forceJpg: true,
        compressImageMaxWidth: 1600,
        compressImageMaxHeight: 1600,
        compressImageQuality: 0.8,
      });
      if (!alive.current) {
        for (const image of images)
          void ImagePicker.cleanSingle(image.path).catch(() => {});
        return;
      }
      const valid: Photo[] = [];
      for (const image of images) files.current.add(image.path);
      if (
        images.length > 4 - photos.length ||
        images.some((image) => !image.size || image.size > 3 * 1024 * 1024)
      )
        throw new Error("最多四张图片，每张压缩后需小于 3 MB");
      try {
        for (const image of images)
          valid.push({ path: await retainDraftImage(image.path) });
        if (!alive.current || (await currentAccountId()) !== owner) {
          for (const photo of valid) void removeDraftImage(photo.path);
          return;
        }
        setPhotos((previous) => [...previous, ...valid]);
      } catch (error) {
        for (const photo of valid) void removeDraftImage(photo.path);
        throw error;
      } finally {
        for (const image of images) {
          files.current.delete(image.path);
          void ImagePicker.cleanSingle(image.path).catch(() => {});
        }
      }
    } catch (error) {
      if ((error as { code?: string }).code !== "E_PICKER_CANCELLED")
        Toast.show({
          type: "error",
          text1: "选择图片失败",
          text2:
            error instanceof Error ? error.message : "请检查相册权限后重试",
        });
    } finally {
      working.current = false;
      if (alive.current) setChoosing(false);
    }
  }
  function remove(index: number) {
    const photo = photos[index];
    setPhotos((previous) => previous.filter((_, i) => i !== index));
    void removeDraftImage(photo.path);
  }
  async function publish() {
    if (working.current || !canPublish) return;
    revision.current++;
    polishController.current?.abort();
    setPolishing(false);
    working.current = true;
    setBusy(true);
    try {
      if (!owner || (await currentAccountId()) !== owner)
        throw new Error("请登录原账号后再发布");
      const attached = application
        ? {
            appId: application.manifest.appId,
            releaseId: application.manifest.releaseId,
            params: applicationParams,
          }
        : undefined;
      const signature = JSON.stringify({
        body: body.trim(),
        paths: photos.map((photo) => photo.path),
        application: attached,
        content,
      });
      if (request.current?.signature !== signature)
        request.current = {
          signature,
          id: `${Date.now().toString(36)}-${Math.random()
            .toString(36)
            .slice(2)}-${Math.random().toString(36).slice(2)}`,
        };
      const uploaded = [...photos];
      for (let index = 0; index < uploaded.length; index++) {
        if (uploaded[index].id) continue;
        setStatus(`正在上传图片 ${index + 1}/${uploaded.length}…`);
        const image = await uploadPostImage(uploaded[index].path);
        if ((await currentAccountId()) !== owner)
          throw new Error("账号已改变，请重试");
        uploaded[index] = { ...uploaded[index], ...image };
        if (alive.current) setPhotos([...uploaded]);
      }
      setStatus("正在发布…");
      await publishUserPost(
        body.trim(),
        uploaded.map((photo) => photo.id!),
        request.current!.id,
        attached,
        content,
      );
      writeShellValue(draftKey, "");
      for (const photo of uploaded) void removeDraftImage(photo.path);
      if (alive.current) {
        setBusy(false);
        setStatus("");
        setPublished(true);
        Toast.show({ type: "success", text1: "动态已发布" });
      }
    } catch (error) {
      if (alive.current)
        Toast.show({
          type: "error",
          text1: "发布未完成",
          text2:
            error instanceof Error ? error.message : "内容已保留，可以重试",
        });
    } finally {
      working.current = false;
      if (alive.current) {
        setBusy(false);
        setStatus("");
      }
    }
  }
  const removePhoto = useEventCallback(remove);
  const chooseApplication = useEventCallback(selectApplication);
  const attachedCard = useMemo(() => application ? { ...application.manifest, title: application.title || application.manifest.appName, summary: application.summary ?? application.manifest.description } : undefined, [application]);
  const Root = embedded ? View : Screen;
  return (
    <ScreenEdge bottom={false}><Root style={[styles.screen, embedded && { backgroundColor: "transparent" }]}>
      {!embedded ? (
        <PageHeader
          title={modeTabs ? "发布" : "发动态"}
          onBack={onBack}
          backDisabled={busy}
        />
      ) : null}
      {modeTabs}
      {!attachmentReady ? <View style={{ padding: 16, gap: 8 }}>{attachmentError ? <><Text style={{ color: colors.danger }}>{attachmentError}</Text><Pressy onPress={() => setAttachmentRetry(value => value + 1)}><Text style={{ color: colors.accent }}>重试读取应用</Text></Pressy><Pressy onPress={() => selectApplication()}><Text style={{ color: colors.ink3 }}>移除附带应用</Text></Pressy></> : <PageSkeleton rows={1} shape="picker" />}</View> : null}
      <KeyboardViewport>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.author}>
            <UserAvatar uri={user?.avatarUrl} size={32} style={styles.avatar} />
            <Text style={styles.name}>{user?.name || "我"}</Text>
          </View>
          <View style={styles.htmlHeader}>
            <Text style={styles.name}>{htmlMode ? "HTML 动态" : "动态内容"}</Text>
            <View style={styles.headerActions}>
              <Pressy accessibilityLabel={polishing ? "取消 AI 润色" : "AI 润色动态"}
                disabled={!draftReady || busy || !text.trim()} style={styles.htmlAction}
                onPress={() => {
                  if (polishing) { polishController.current?.abort(); setPolishing(false); }
                  else void polish();
                }}>
                {polishing ? <ActivityIndicator color={colors.orchidText} size="small" /> : <SymbolIcon name="spark" size={15} strokeWidth={2.1} color={colors.orchid} />}
                <Text style={styles.addText}>{polishing ? "取消润色" : "AI 润色"}</Text>
              </Pressy>
              {beforePolish !== undefined ? <Pressy accessibilityLabel="撤销 AI 润色" style={styles.htmlAction} disabled={busy}
                onPress={() => change(beforePolish)}><Text style={styles.addText}>撤销润色</Text></Pressy> : null}
              <Pressy accessibilityLabel={previewing ? "编辑动态" : "预览动态"} disabled={busy}
                onPress={() => { Keyboard.dismiss(); setPreviewing(value => !value); }} style={styles.htmlAction}>
                <Text style={styles.addText}>{previewing ? "编辑" : "预览"}</Text>
              </Pressy>
              </View>
          </View>
          {previewing ? (
            <View style={{ gap: 8, minHeight: 160 }}>
              {htmlMode && caption ? <Text style={styles.previewText}>{caption}</Text> : null}
              {htmlMode ? <HtmlPostContent html={previewHtml} /> : <Text selectable style={styles.previewText}>{text || "还没有内容，点击编辑开始输入"}</Text>}
            </View>
          ) : (
            <TextInput accessibilityLabel={htmlMode ? "HTML 动态源码" : "动态内容"} multiline scrollEnabled
              editable={draftReady && !busy} value={text} onChangeText={change}
              maxLength={htmlMode ? 32768 : 4000}
              placeholder={htmlMode ? '<p style="color:#806020">分享你的创造</p>' : "分享此刻的想法…"}
              placeholderTextColor={colors.ink3} style={[styles.input, { height: 200 }]} textAlignVertical="top"
              autoCapitalize={htmlMode ? "none" : "sentences"} autoCorrect={!htmlMode} />
          )}
          <ComposerPhotos photos={photos} busy={busy} styles={styles} remove={removePhoto} />
          <View style={styles.tools}>
            <View style={styles.tool}>
              <Text style={styles.addText}>HTML</Text>
              <View style={styles.switchSlot}><Switch accessibilityLabel="作为 HTML 发布" value={htmlMode} disabled={!draftReady || busy}
                trackColor={{ false: colors.lineStrong, true: colors.green }}
                thumbColor="#FFFFFF" hitSlop={12} style={{ transform: [{ scale: 0.7 }] }}
                onValueChange={value => {
                  revision.current++;
                  polishController.current?.abort();
                  setPolishing(false); setBeforePolish(undefined); setPolishError("");
                  setHtmlMode(value);
                }} /></View>
            </View>
            <Pressy
              accessibilityLabel="添加图片，最多四张"
              disabled={!draftReady || busy || choosing || photos.length >= 4}
              onPress={() => void choose()}
              style={styles.tool}
            >
              <SymbolIcon name="photo" size={15} strokeWidth={2.1} color={colors.cyan} />
              <Text style={styles.addText}>
                {choosing ? "处理图片…" : `图片 ${photos.length}/4`}
              </Text>
            </Pressy>
            <Pressy
              accessibilityLabel="选择公开应用"
              disabled={!draftReady || busy || choosing}
              onPress={() => void pickApplication()}
              style={styles.tool}
            >
              <SymbolIcon name="box" size={15} strokeWidth={2.1} color={colors.orange} />
              <Text style={styles.addText}>
                {application ? "更换应用" : "附带应用"}
              </Text>
            </Pressy>
          </View>
          <View style={styles.draftStatus}>
            <Text style={styles.counter}>
              {draftReady ? "草稿自动保存" : "正在读取草稿…"}
            </Text>
            <Text
              style={[styles.counter, (htmlMode ? htmlBytes > 32768 : count > 2000) && { color: colors.danger }]}
            >
              {htmlMode ? `${htmlBytes}/32768 字节` : `${count}/2000`}
            </Text>
          </View>
          {polishError ? <View style={{ gap: 4 }}>
            <Text style={{ color: colors.danger, fontSize: 12 }}>{polishError}</Text>
            {/配置|引擎/.test(polishError) ? <Pressy accessibilityLabel="配置 AI 引擎" style={styles.htmlAction}
              onPress={() => applicationContext("jolly").ai.openSettings()}><Text style={styles.addText}>配置 AI 引擎</Text></Pressy> : null}
          </View> : null}
          {application ? (
            <View>
              <ApplicationPostCard
                preview
                application={attachedCard!}
              />
              <Pressable
                disabled={busy}
                onPress={() => selectApplication()}
                style={styles.add}
              >
                <Text style={styles.counter}>移除应用</Text>
              </Pressable>
            </View>
          ) : null}

          {busy ? (
            <View style={styles.status}>
              <ActivityIndicator size="small" color={colors.ink2} />
              <Text style={styles.counter}>{status || "准备发布…"}</Text>
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.publishDock}>
          <Pressy
            accessibilityRole="button"
            accessibilityLabel="发布动态"
            accessibilityState={{ disabled: !canPublish, busy }}
            disabled={!canPublish}
            onPress={() => void publish()}
            style={[styles.publish, !canPublish && styles.disabled]}
          >
            {busy ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Text style={styles.publishText}>发布动态</Text>}
          </Pressy>
        </View>
      </KeyboardViewport>
      <EdgeModal
        visible={picking}
        transparent
        animationType="slide"
        onRequestClose={() => setPicking(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.mode === "dark" ? "rgba(0,0,0,0.72)" : "rgba(12,12,13,0.42)",
            justifyContent: "flex-end",
          }}
        >
          <Pressable
            accessibilityLabel="关闭应用选择"
            onPress={() => setPicking(false)}
            style={{ flex: 1 }}
          />
          <View
            style={{
              backgroundColor: colors.canvas,
              borderTopLeftRadius: colors.components.dialogRadius,
              borderTopRightRadius: colors.components.dialogRadius,
              borderTopWidth: colors.mode === "dark" ? colors.components.surfaceBorder : 0,
              borderColor: colors.line,
              paddingHorizontal: 16,
              paddingTop: 16,
              paddingBottom: 12 + insets.bottom,
              maxHeight: "75%",
              gap: 10,
              boxShadow: colors.shadow.modal,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.orangeTint, alignItems: "center", justifyContent: "center" }}><SymbolIcon name="box" size={16} strokeWidth={2.1} color={colors.orange} /></View>
              <Text style={{ flex: 1, color: colors.ink1, ...colors.type.headline }}>选择应用</Text>
              <Pressy scale={1} accessibilityLabel="关闭应用选择" onPress={() => setPicking(false)} style={{ width: 44, height: 44, alignItems: "center" }}><SymbolIcon name="close" size={16} color={colors.ink3} /></Pressy>
            </View>
            <Text style={styles.counter}>选择任何已公开的作品</Text>
            <View style={{ flexDirection: "row", gap: 8 }}><TextInput value={appsQuery} onChangeText={setAppsQuery} placeholder="搜索应用" returnKeyType="search" onSubmitEditing={() => void pickApplication(false)} style={{ flex: 1 }} /><Pressy accessibilityLabel="搜索应用" disabled={loadingApps} onPress={() => void pickApplication(false)} style={{ padding: 12, justifyContent: "center" }}><SymbolIcon name="search" size={20} color={colors.ink1} /></Pressy></View>
            <AnimatedFlashList data={!applications.length && (loadingApps || appsError) ? [] : applications} keyExtractor={item => item.manifest.appId} maintainVisibleContentPosition={{ disabled: true }} keyboardShouldPersistTaps="handled" style={{ minHeight: 160 }}
              ListFooterComponent={appsCursor ? <Pressable disabled={loadingApps} onPress={() => void pickApplication(true)} style={styles.add}><Text style={styles.counter}>{loadingApps ? "加载中…" : "加载更多作品"}</Text></Pressable> : null}
              renderItem={({ item }) => <ApplicationPickerRow item={item} styles={styles} selectApplication={chooseApplication} />}
              ListEmptyComponent={loadingApps ? <PageSkeleton rows={3} shape="picker" /> : appsError ? <Pressable onPress={() => void pickApplication()} style={styles.add}><Text style={{ color: colors.danger }}>{appsError} · 重试</Text></Pressable> : <EmptyState style={{ minHeight: 160, flexGrow: 0 }}><Text style={{ color: colors.ink3, textAlign: "center" }}>没有找到公开作品。</Text></EmptyState>}
            />
            <Pressable onPress={() => setPicking(false)} style={styles.add}>
              <Text style={[styles.addText, { textAlign: "center" }]}>
                取消
              </Text>
            </Pressable>
          </View>
        </View>
      </EdgeModal>
    </Root></ScreenEdge>
  );
});
const useStyles = createThemedStyles((base) => {
  const t = base;
  return {
    screen: { flex: 1, backgroundColor: t.canvas },
    content: { paddingHorizontal: 16, paddingTop: 6, gap: 12, paddingBottom: 12 },
    previewText: { color: t.ink1, fontSize: 15, lineHeight: 22 },
    htmlHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    headerActions: { flexDirection: "row", flexWrap: "wrap", flexShrink: 1, justifyContent: "flex-end", alignItems: "center", gap: 6 },
    htmlAction: { flexDirection: "row", gap: 4, minHeight: 30, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: t.surfaceRaised },
    publishDock: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
    author: { flexDirection: "row", gap: 10, alignItems: "center" },
    avatar: { width: 32, height: 32, borderRadius: 16 },
    name: { color: t.ink1, fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
    input: {
      minHeight: 140,
      color: t.ink1,
      fontSize: 15,
      lineHeight: 23,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderRadius: t.radius.xl,
      borderWidth: t.mode === "dark" ? t.components.surfaceBorder : 0,
      borderColor: t.line,
      backgroundColor: t.surface,
      boxShadow: t.shadow.card,
    },
    photos: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    photo: {
      width: "48%",
      aspectRatio: 1,
      borderRadius: t.radius.lg,
      overflow: "hidden",
      backgroundColor: t.surfaceRaised,
    },
    image: { width: "100%", height: "100%" },
    remove: {
      position: "absolute",
      right: 6,
      top: 6,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "rgba(0,0,0,0.55)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.3)",
      alignItems: "center",
      justifyContent: "center",
    },
    removeText: { color: "#FFFFFF", fontSize: 18 },
    switchSlot: { width: 36, height: 24, alignItems: "center", justifyContent: "center" },
    tools: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    tool: {
      flexDirection: "row",
      gap: 5,
      alignItems: "center",
      minHeight: 32,
      backgroundColor: t.surfaceRaised,
      borderWidth: 0,
      borderRadius: 16,
      paddingHorizontal: 8,
    },
    draftStatus: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    add: { paddingVertical: 10 },
    addText: { color: t.ink1, fontSize: 12, fontWeight: "700" },
    counter: {
      color: t.ink3,
      fontSize: 12,
      lineHeight: 17,
    },
    publish: {
      backgroundColor: t.accent,
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 23,
      minHeight: 46,
      minWidth: 76,
      justifyContent: "center",
      alignItems: "center",
    },
    publishText: { color: t.onAccent, fontWeight: "700", fontSize: 15, letterSpacing: -0.1 },
    disabled: { opacity: 0.3 },
    status: { flexDirection: "row", gap: 10, alignItems: "center" },
  };
});

const ComposerPhotos = memo(function ComposerPhotos({ photos, busy, styles, remove }: { photos: Photo[]; busy: boolean; styles: ReturnType<typeof useStyles>; remove: (index: number) => void }) {
  return (          <View style={styles.photos}>
            {photos.map((photo, index) => (
              <View key={photo.path} style={styles.photo}>
                <AppImage
                  source={{
                    uri: photo.path.startsWith("file:")
                      ? photo.path
                      : `file://${photo.path}`,
                  }}
                  style={styles.image}
                />
                {!busy ? (
                  <Pressable
                    accessibilityLabel={`移除第 ${index + 1} 张图片`}
                    onPress={() => remove(index)}
                    style={styles.remove}
                  >
                    <Text style={styles.removeText}>×</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>);
});

const ApplicationPickerRow = memo(function ApplicationPickerRow({ item, styles, selectApplication }: { item: MarketApplication; styles: ReturnType<typeof useStyles>; selectApplication: (item: MarketApplication) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityLabel={`选择${
        item.title || item.manifest.appName
      }`}
      onPress={() => selectApplication(item)}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 4,
        gap: 2,
        borderBottomWidth: colors.components.surfaceBorder,
        borderBottomColor: colors.line,
      }}
    >
      <Text style={styles.name}>
        {item.title || item.manifest.appName}
      </Text>
      <Text numberOfLines={1} style={styles.counter}>作者：{item.authorName}</Text>
      <Text numberOfLines={2} style={styles.counter}>
        {item.summary || item.manifest.description}
      </Text>
    </Pressable>
);
});
