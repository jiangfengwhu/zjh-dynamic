import ImagePicker from "react-native-image-crop-picker";
import { loadImage, type Image } from "react-native-nitro-image";
import BlobUtil from "react-native-blob-util";

export type PickedPhoto = { path: string; size: number; width: number; height: number; mime: "image/jpeg" };
export type PhotoPickerOptions = {
  mediaType?: "photo";
  multiple?: boolean;
  maxFiles?: number;
  cropping?: boolean;
  cropperCircleOverlay?: boolean;
  width?: number;
  height?: number;
  compressImageMaxWidth?: number;
  compressImageMaxHeight?: number;
  compressImageQuality?: number;
  forceJpg?: boolean;
  cropperToolbarTitle?: string;
  cropperChooseText?: string;
  cropperCancelText?: string;
};
const temporaryDirectory = `${BlobUtil.fs.dirs.CacheDir}/zjh-picked-photos`;
let picking = false;
function temporaryPath() { return `${temporaryDirectory}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}.jpg`; }
async function cleanSingle(path: string) {
  const file = path.replace(/^file:\/\//, "");
  // Only our own encoded copies may be deleted. Never unlink gallery originals.
  if (file.startsWith(`${temporaryDirectory}/`) && /^[a-z0-9-]+\.jpg$/.test(file.slice(temporaryDirectory.length + 1))) {
    await BlobUtil.fs.unlink(file).catch(() => {});
  }
}
async function encodePhoto(source: string, options: PhotoPickerOptions): Promise<PickedPhoto> {
  const target = temporaryPath();
  let inputCopy: string | undefined;
  let image: Image | undefined;
  let resized: Image | undefined;
  try {
    let filePath = source.replace(/^file:\/\//, "");
    if (filePath.startsWith("content:")) {
      inputCopy = temporaryPath();
      await BlobUtil.fs.cp(source, inputCopy);
      filePath = inputCopy;
    }
    image = await loadImage({ filePath });
    const maxWidth = options.width ?? options.compressImageMaxWidth ?? 1600;
    const maxHeight = options.height ?? options.compressImageMaxHeight ?? 1600;
    const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    resized = scale < 1 ? await image.resizeAsync(width, height) : image;
    await resized.saveToFileAsync(target, "jpg", Math.round((options.compressImageQuality ?? 0.8) * 100));
    const info = await BlobUtil.fs.stat(target);
    return { path: target, size: Number(info.size), width, height, mime: "image/jpeg" };
  } catch (error) {
    await cleanSingle(target);
    throw error;
  } finally {
    if (resized && resized !== image) resized.dispose();
    image?.dispose();
    if (inputCopy) await cleanSingle(inputCopy);
  }
}
async function pick(options: PhotoPickerOptions): Promise<PickedPhoto[]> {
  if (picking) throw new Error("相册已打开，请完成当前选择");
  picking = true;
  const encoded: PickedPhoto[] = [];
  try {
    const maxFiles = options.multiple ? options.maxFiles ?? 4 : 1;
    if (!Number.isInteger(maxFiles) || maxFiles < 1 || maxFiles > 20) throw new Error("图片数量无效");
    const limits = [options.width, options.height, options.compressImageMaxWidth, options.compressImageMaxHeight];
    if (limits.some(value => value !== undefined && (!Number.isFinite(value) || value < 1 || value > 8192))) throw new Error("图片尺寸无效");
    const quality = options.compressImageQuality ?? 0.8;
    if (!Number.isFinite(quality) || quality < 0 || quality > 1) throw new Error("图片压缩质量无效");
    // Keep the verified native picker; do final dimensions/JPEG encoding here.
    // Baronha 2.2.5 fails Nitro 0.37 C++ compilation and duplicates uCrop classes.
    const selected = await ImagePicker.openPicker({
      ...options, mediaType: "photo", multiple: Boolean(options.multiple), maxFiles,
      forceJpg: true, compressImageQuality: 1,
      compressImageMaxWidth: undefined, compressImageMaxHeight: undefined,
    });
    const photos = Array.isArray(selected) ? selected : [selected];
    if (!photos.length) throw Object.assign(new Error("已取消选择"), { code: "E_PICKER_CANCELLED" });
    if (photos.length > maxFiles || photos.some(photo => !photo.mime?.startsWith("image/") || !photo.path)) throw new Error("相册返回的图片无效");
    if (!await BlobUtil.fs.exists(temporaryDirectory)) await BlobUtil.fs.mkdir(temporaryDirectory);
    for (const photo of photos) encoded.push(await encodePhoto(photo.path, options));
    return encoded;
  } catch (error) {
    await Promise.all(encoded.map(photo => cleanSingle(photo.path)));
    if (error === 0 || (error as { code?: string })?.code === "E_PICKER_CANCELLED") {
      throw Object.assign(new Error("已取消选择"), { code: "E_PICKER_CANCELLED" });
    }
    throw error instanceof Error ? error : new Error("选择图片失败，请检查相册权限后重试");
  } finally { picking = false; }
}
function pickPhotos(options: PhotoPickerOptions & { multiple: true }): Promise<PickedPhoto[]>;
function pickPhotos(options: PhotoPickerOptions & { multiple?: false }): Promise<PickedPhoto>;
async function pickPhotos(options: PhotoPickerOptions) {
  const photos = await pick(options);
  return options.multiple ? photos : photos[0]!;
}
/** Host and SDK callers share JPEG encoding, cancellation and safe temporary cleanup. */
export const MediaPicker = { openPicker: pickPhotos, cleanSingle };
