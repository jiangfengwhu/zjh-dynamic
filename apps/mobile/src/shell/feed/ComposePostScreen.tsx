import { LoadingSkeleton } from "../LoadingSkeleton";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { FormField as TextInput } from "../FormField";
import { PixelIcon } from "./PixelKit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppImage } from "../../../../../packages/ui/media/AppImage";
import { MediaPicker as ImagePicker } from "../../../../../packages/ui/media/MediaPicker";
import { KeyboardViewport } from "../KeyboardViewport";
import { usePreventRemove } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { PageHeader, Pressy } from "../../../../../packages/ui/chrome";
import { EdgeModal, Screen, ScreenEdge } from "../../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../../packages/ui/theme";
import {
  cachedAccountId,
  currentAccountId,
  uploadPostImage,
  useAccount,
} from "../account";
import { readShellValue, writeShellValue } from "../shellStorage";
import { publishUserPost } from "./userPosts";
import { fetchMarket, type MarketApplication } from "../market";
import { ApplicationPostCard } from "./ApplicationPostCard";
import {
  retainDraftImage,
  removeDraftImage,
  existingDraftImages,
} from "../mediaDraft";

import { HtmlPostContent } from "./HtmlPostContent";
import { htmlByteLength } from "./postDraft";
import type { UserPostDraft } from "../../../../../packages/app-sdk/src/index";
import { pixelTheme } from "./pixelTheme";

export type ComposePostControls = {
  canPublish: boolean;
  busy: boolean;
  submit: () => void;
};

type Photo = { path: string; id?: string; url?: string };
export function ComposePostScreen({
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
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAccount();
  const owner = useRef(cachedAccountId()).current;
  const [text, setText] = useState(
    initialDraft?.body ??
      (initialApplication
        ? `我发布了《${
            initialApplication.title || initialApplication.manifest.title
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
  const [picking, setPicking] = useState(false);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appsError, setAppsError] = useState("");
  const [applications, setApplications] = useState<MarketApplication[]>([]);
  const [html, setHtml] = useState(initialDraft?.html ?? "");
  const [htmlMode, setHtmlMode] = useState(!!initialDraft?.html);
  const [previewing, setPreviewing] = useState(false);
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
  const count = Array.from(text).length;
  const canPublish =
    draftReady &&
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
            setText(typeof draft.body === "string" ? draft.body : "");
            setApplication(
              draft.application?.authorId === owner
                ? draft.application
                : initialApplication,
            );
            setPhotos(restored);
            setHtml(typeof draft.html === "string" ? draft.html : "");
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
      for (const path of files.current)
        void ImagePicker.cleanSingle(path).catch(() => {});
    };
  }, [owner, draftKey]);
  useEffect(() => {
    if (draftReady && owner && !published)
      writeShellValue(
        draftKey,
        JSON.stringify({ body: text, application, photos, html, htmlMode }),
      );
  }, [
    draftReady,
    text,
    application,
    photos,
    html,
    htmlMode,
    published,
    draftKey,
  ]);
  function saveDraft(body: string, selected?: MarketApplication) {
    revision.current++;
    if (owner && draftReady)
      writeShellValue(
        draftKey,
        JSON.stringify({ body, application: selected, photos, html, htmlMode }),
      );
  }
  function change(value: string) {
    setText(value);
    saveDraft(value, application);
  }
  function selectApplication(item?: MarketApplication) {
    setApplication(item);
    setPicking(false);
    saveDraft(text, item);
  }
  async function pickApplication() {
    if (working.current || loadingApps || !draftReady) return;
    Keyboard.dismiss();
    setPicking(true);
    setLoadingApps(true);
    setAppsError("");
    try {
      const items = await fetchMarket(owner);
      if ((await currentAccountId()) !== owner)
        throw new Error("账号已改变，请重试");
      if (alive.current)
        setApplications(items.filter((item) => item.authorId === owner));
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
    working.current = true;
    setBusy(true);
    try {
      if (!owner || (await currentAccountId()) !== owner)
        throw new Error("请登录原账号后再发布");
      const attached = application
        ? {
            appId: application.manifest.appId,
            releaseId: application.manifest.releaseId,
          }
        : undefined;
      const signature = JSON.stringify({
        body: text.trim(),
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
        text.trim(),
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
  const Root = embedded ? View : Screen;
  return (
    <ScreenEdge bottom={false}><Root style={styles.screen}>
      {!embedded ? (
        <PageHeader
          title={modeTabs ? "发布" : "发动态"}
          variant="pixel"
          onBack={busy ? undefined : onBack}
        />
      ) : null}
      {modeTabs}
      <KeyboardViewport>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.author}>
            {user?.avatarUrl ? (
              <AppImage
                source={{ uri: user.avatarUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.placeholder]}>
                <Text style={styles.initial}>
                  {Array.from(user?.name || "我")[0]}
                </Text>
              </View>
            )}
            <Text style={styles.name}>{user?.name || "我"}</Text>
          </View>
          <TextInput
            accessibilityLabel="动态内容"
            multiline
            editable={draftReady && !busy}
            value={text}
            onChangeText={change}
            maxLength={4000}
            placeholder="分享此刻的想法…"
            placeholderTextColor={colors.ink3}
            style={styles.input}
            textAlignVertical="top"
          />
          {htmlMode ? (
            <View style={{ gap: 8 }}>
              <View style={styles.htmlHeader}>
                <Text style={styles.name}>HTML 内容</Text>
                <Pressy
                  accessibilityLabel={previewing ? "编辑 HTML" : "预览 HTML"}
                  disabled={busy}
                  onPress={() => setPreviewing((value) => !value)}
                  style={styles.htmlAction}
                >
                  <Text style={styles.addText}>
                    {previewing ? "编辑" : "预览"}
                  </Text>
                </Pressy>
              </View>
              {previewing ? (
                <HtmlPostContent html={previewHtml} />
              ) : (
                <TextInput
                  accessibilityLabel="HTML 源码"
                  multiline
                  editable={draftReady && !busy}
                  value={html}
                  onChangeText={(value) => {
                    revision.current++;
                    setHtml(value);
                  }}
                  maxLength={32768}
                  placeholder='<p style="color:#806020">分享你的创造</p>'
                  style={styles.input}
                  textAlignVertical="top"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
              <Text
                style={[
                  styles.counter,
                  htmlBytes > 32768 && { color: colors.danger },
                ]}
              >
                {htmlBytes}/32768 字节 · 支持简单内联样式
              </Text>
            </View>
          ) : null}
          <View style={styles.photos}>
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
          </View>
          <View style={styles.tools}>
            <Pressy
              accessibilityLabel={
                htmlMode ? "关闭 HTML 内容" : "添加 HTML 内容"
              }
              accessibilityState={{ selected: htmlMode }}
              disabled={!draftReady || busy || choosing}
              onPress={() => {
                revision.current++;
                setHtmlMode((value) => !value);
              }}
              style={styles.tool}
            >
              <Text style={styles.addText}>
                {htmlMode ? "HTML 已开启" : "HTML"}
              </Text>
            </Pressy>
            <Pressy
              accessibilityLabel="添加图片，最多四张"
              disabled={!draftReady || busy || choosing || photos.length >= 4}
              onPress={() => void choose()}
              style={styles.tool}
            >
              <PixelIcon name="photo" size={18} color={colors.accentText} />
              <Text style={styles.addText}>
                {choosing ? "处理图片…" : `图片 ${photos.length}/4`}
              </Text>
            </Pressy>
            <Pressy
              accessibilityLabel="选择自己已上架的应用"
              disabled={!draftReady || busy || choosing}
              onPress={() => void pickApplication()}
              style={styles.tool}
            >
              <PixelIcon name="layers" size={18} color={colors.accentText} />
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
              style={[styles.counter, count > 2000 && { color: colors.danger }]}
            >
              {count}/2000
            </Text>
          </View>
          {application ? (
            <View>
              <ApplicationPostCard
                preview
                application={{
                  ...application.manifest,
                  title: application.title || application.manifest.title,
                  summary: application.summary ?? application.manifest.summary,
                }}
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
              <LoadingSkeleton size="small" color={colors.accent} />
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
            {busy ? <LoadingSkeleton size="small" color={colors.onAccent} /> : <Text style={styles.publishText}>发布动态</Text>}
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
            backgroundColor: "rgba(25,21,44,0.46)",
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
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              borderTopWidth: 0.5,
              borderColor: colors.lineStrong,
              padding: 16,
              paddingBottom: 12 + insets.bottom,
              maxHeight: "75%",
              gap: 8,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: colors.orchidTint, alignItems: "center", justifyContent: "center" }}><PixelIcon name="box" size={18} color={colors.orchidText} /></View>
              <Text style={{ flex: 1, color: colors.ink1, fontSize: 16 }}>我的已上架应用</Text>
              <Pressy scale={1} accessibilityLabel="关闭应用选择" onPress={() => setPicking(false)} style={{ width: 44, height: 44, alignItems: "center" }}><PixelIcon name="close" size={16} color={colors.ink3} /></Pressy>
            </View>
            <Text style={styles.counter}>仅分享应用市场里的公开版本</Text>
            <ScrollView keyboardShouldPersistTaps="handled">
              {loadingApps ? (
                <LoadingSkeleton
                  color={colors.accent}
                  style={{ padding: 16 }}
                />
              ) : appsError ? (
                <Pressable
                  onPress={() => void pickApplication()}
                  style={styles.add}
                >
                  <Text style={{ color: colors.danger }}>
                    {appsError} · 重试
                  </Text>
                </Pressable>
              ) : applications.length ? (
                applications.map((item) => (
                  <Pressable
                    key={item.manifest.appId}
                    accessibilityLabel={`选择${
                      item.title || item.manifest.title
                    }`}
                    onPress={() => selectApplication(item)}
                    style={{
                      paddingVertical: 12,
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.line,
                    }}
                  >
                    <Text style={styles.name}>
                      {item.title || item.manifest.title}
                    </Text>
                    <Text numberOfLines={2} style={styles.counter}>
                      {item.summary || item.manifest.summary}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={{ color: colors.ink3, paddingVertical: 12 }}>
                  还没有已上架应用。先在作品详情中发布到市场，就可以分享了。
                </Text>
              )}
            </ScrollView>
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
}
const styles = themedStyleSheet((base) => {
  const t = pixelTheme(base);
  return {
    screen: { flex: 1, backgroundColor: t.canvas },
    fill: { flex: 1 },
    content: { padding: 16, paddingTop: 8, gap: 16, paddingBottom: 16 },
    htmlHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    htmlAction: { minHeight: 44, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
    publishDock: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: t.canvas },
    author: { flexDirection: "row", gap: 12, alignItems: "center" },
    avatar: { width: 36, height: 36, borderRadius: 18 },
    placeholder: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.accentTint,
    },
    initial: { color: t.accentText, fontSize: 20 },
    name: { color: t.ink1, fontSize: 16, fontWeight: "600" },
    input: {
      minHeight: 144,
      color: t.ink1,
      fontSize: 15,
      lineHeight: 22,
      padding: 12,
      borderRadius: 4,
      backgroundColor: t.greenTint,
    },
    photos: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    photo: {
      width: "48%",
      aspectRatio: 1,
      borderRadius: 14,
      overflow: "hidden",
      backgroundColor: t.surface,
    },
    image: { width: "100%", height: "100%" },
    remove: {
      position: "absolute",
      right: 6,
      top: 6,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: "#00000099",
      alignItems: "center",
      justifyContent: "center",
    },
    removeText: { color: "#FFFFFF", fontSize: 22 },
    tools: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    tool: {
      flexDirection: "row",
      gap: 6,
      alignItems: "center",
      backgroundColor: t.inset,
      borderRadius: t.radius.sm,
      paddingHorizontal: 12,
    },
    draftStatus: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    add: { paddingVertical: 12 },
    addText: { color: t.accentText, fontSize: 13, fontWeight: "600" },
    counter: {
      color: t.ink3,
      fontSize: 11,
      lineHeight: 17,
      fontFamily: t.mono,
    },
    publish: {
      backgroundColor: t.accent,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: t.radius.sm,
      minHeight: 48,
      minWidth: 68,
      justifyContent: "center",
      alignItems: "center",
    },
    publishText: { color: t.onAccent, fontWeight: "600", fontSize: 14 },
    disabled: { opacity: 0.4 },
    status: { flexDirection: "row", gap: 10, alignItems: "center" },
  };
});
