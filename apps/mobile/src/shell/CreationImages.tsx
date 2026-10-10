import { useEventCallback } from "./useEventCallback";
import { memo, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { MediaPicker } from "../../../../packages/ui/media/MediaPicker";
import { AppImage } from "../../../../packages/ui/media/AppImage";
import { HostText as Text } from "./feed/HostText";
import { SymbolIcon } from "../../../../packages/ui/chrome/SymbolIcon";
import { useTheme } from "../../../../packages/ui/theme";
import {
  retainDraftImage,
  existingDraftImages,
  removeDraftImage,
} from "./mediaDraft";
import { currentAccountId, uploadCreationImage } from "./account";
import {
  readShellValue,
  readShellValueSync,
  writeShellValue,
  removeShellValue,
} from "./shellStorage";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";

type Photo = { path?: string; url?: string };
export function useCreationImages(owner: string | undefined, scope: string) {
  const key = `creation.images.${owner ?? "guest"}.${scope}`;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [ready, setReady] = useState(false);
  const [picking, setPicking] = useState(false);
  const alive = useRef(true);
  const flight = useRef(false);
  const latest = useRef({ key, photos, ready });
  latest.current = { key, photos, ready };
  useEffect(
    () => () => {
      alive.current = false;
      const draft = latest.current;
      if (draft.ready) writeShellValue(draft.key, JSON.stringify(draft.photos));
    },
    []
  );
  useEffect(() => {
    let valid = true;
    setReady(false);
    setPhotos([]);
    void readShellValue(key)
      .then(async (raw) => {
        const cached = JSON.parse(raw || "[]");
        const items: Photo[] = Array.isArray(cached) ? cached.slice(0, 3) : [];
        const local = await existingDraftImages(items);
        const remote = items.filter(
          (item) =>
            !item.path &&
            typeof item.url === "string" &&
            item.url.startsWith("https://")
        );
        if (valid) setPhotos([...local, ...remote].slice(0, 3));
      })
      .catch(() => {
        if (valid)
          Toast.show({
            type: "error",
            text1: "参考图草稿未能恢复，请重新选择",
          });
      })
      .finally(() => {
        if (valid) setReady(true);
      });
    return () => {
      valid = false;
    };
  }, [key]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(
      () => writeShellValue(key, JSON.stringify(photos)),
      180
    );
    return () => clearTimeout(timer);
  }, [key, photos, ready]);
  async function choose() {
    if (flight.current || !ready || !owner || photos.length >= 3) return;
    flight.current = true;
    setPicking(true);
    const chosen: string[] = [];
    const retained: Photo[] = [];
    try {
      const images = await MediaPicker.openPicker({
        mediaType: "photo",
        multiple: true,
        maxFiles: 3 - photos.length,
        forceJpg: true,
        compressImageMaxWidth: 1600,
        compressImageMaxHeight: 2400,
        compressImageQuality: 0.75,
      });
      chosen.push(...images.map((image) => image.path));
      if (
        images.length > 3 - photos.length ||
        images.some((image) => image.size > 2 * 1024 * 1024)
      )
        throw new Error("最多 3 张参考图，每张压缩后需小于 2 MB");
      for (const image of images)
        retained.push({ path: await retainDraftImage(image.path) });
      if (
        !alive.current ||
        latest.current.key !== key ||
        (await currentAccountId()) !== owner
      )
        throw new Error("账号或制作页面已改变，请重新选择");
      setPhotos((previous) => [...previous, ...retained]);
    } catch (cause) {
      for (const photo of retained) void removeDraftImage(photo.path);
      if (
        alive.current &&
        (cause as { code?: string }).code !== "E_PICKER_CANCELLED"
      )
        Toast.show({
          type: "error",
          text1: cause instanceof Error ? cause.message : "图片选择失败",
        });
    } finally {
      for (const path of chosen)
        void MediaPicker.cleanSingle(path).catch(() => {});
      flight.current = false;
      if (alive.current) setPicking(false);
    }
  }
  async function upload(onStatus: (status: string) => void) {
    const snapshot = [...photos];
    const urls: string[] = [];
    for (let index = 0; index < snapshot.length; index++) {
      if (
        !alive.current ||
        latest.current.key !== key ||
        (await currentAccountId()) !== owner
      )
        throw new Error("账号或制作页面已改变，请重新提交");
      onStatus(`正在上传参考图 ${index + 1}/${snapshot.length}…`);
      const photo = snapshot[index];
      const url = photo.url || (await uploadCreationImage(photo.path!));
      if (
        !alive.current ||
        latest.current.key !== key ||
        (await currentAccountId()) !== owner
      )
        throw new Error("账号或制作页面已改变，请重新提交");
      urls.push(url);
      snapshot[index] = { ...photo, url };
      setPhotos([...snapshot]);
      writeShellValue(key, JSON.stringify(snapshot));
    }
    return urls;
  }
  function clear() {
    // A newer composer may already have edited these images while the previous
    // submission was running. Never remove its files or overwrite its draft.
    const current = readShellValueSync(key);
    if (current && current !== JSON.stringify(latest.current.photos)) return false;
    for (const photo of latest.current.photos)
      void removeDraftImage(photo.path);
    latest.current = { key, photos: [], ready: false };
    removeShellValue(key);
    if (alive.current) setPhotos([]);
    return true;
  }
  function remove(index: number) {
    const photo = photos[index];
    setPhotos((previous) => previous.filter((_, i) => i !== index));
    void removeDraftImage(photo?.path);
  }
  return { photos, ready, picking, choose, upload, clear, remove };
}

export function CreationImages({
  images,
  disabled,
}: {
  images: ReturnType<typeof useCreationImages>;
  disabled: boolean;
}) {
  const choose = useEventCallback(images.choose);
  const remove = useEventCallback(images.remove);
  return <CreationImagesContent photos={images.photos} ready={images.ready} picking={images.picking} disabled={disabled} choose={choose} remove={remove} />;
}
const CreationImagesContent = memo(function CreationImagesContent({ photos, ready, picking, disabled, choose, remove }: { photos: Photo[]; ready: boolean; picking: boolean; disabled: boolean; choose: () => Promise<void>; remove: (index: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ fontSize: 14 }}>
          参考图片{" "}
          <Text style={{ color: colors.ink3, fontSize: 11 }}>
            {photos.length}/3
          </Text>
        </Text>
        <Pressable
          disabled={
            disabled ||
            !ready ||
            picking ||
            photos.length >= 3
          }
          accessibilityRole="button"
          accessibilityLabel="添加参考图片"
          onPress={() => void choose()}
          style={{
            minHeight: 44,
            paddingHorizontal: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            opacity: disabled || photos.length >= 3 ? 0.5 : 1,
          }}
        >
          <SymbolIcon name="photo" size={16} color={colors.cyanText} />
          <Text style={{ color: colors.cyanText, fontSize: 13 }}>
            {picking ? "正在选择…" : "添加图片"}
          </Text>
        </Pressable>
      </View>
      {photos.length ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {photos.map((photo, index) => (
            <View
              key={photo.path || photo.url}
              style={{ flex: 1, maxWidth: 112, gap: 2 }}
            >
              <AppImage
                source={{
                  uri: photo.path
                    ? `file://${photo.path.replace(/^file:\/\//, "")}`
                    : photo.url,
                }}
                resizeMode="cover"
                style={{
                  width: "100%",
                  aspectRatio: 1,
                  borderRadius: 14,
                  backgroundColor: colors.surfaceRaised,
                }}
              />
              <Pressable
                disabled={disabled || picking}
                accessibilityRole="button"
                accessibilityLabel={`移除参考图 ${index + 1}`}
                onPress={() => remove(index)}
                style={{
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <SymbolIcon name="close" size={10} color={colors.ink3} />
                <Text style={{ color: colors.ink3, fontSize: 11 }}>移除</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ color: colors.ink3, fontSize: 12, lineHeight: 18 }}>
          可附上界面草图、风格参考或问题截图。
        </Text>
      )}
    </View>
  );
});
