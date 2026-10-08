import BlobUtil from "react-native-blob-util";
import NativePluginHost from "../NativePluginHost";
import type { PendingPackage } from "./packageUpdates";

export type ApkProgress = {
  sha256: string;
  phase: "downloading" | "verifying" | "installing" | "ready";
  received: number;
  total: number;
};

export async function installApkUpdate(apk: PendingPackage, onProgress?: (value: ApkProgress) => void) {
  if (!/^[a-f0-9]{64}$/.test(apk.sha256) || !Number.isSafeInteger(apk.bytes) || apk.bytes <= 0 || apk.url !== `https://zjh-cdn.297782.xyz/v1/apk/${apk.sha256}.apk`) throw new Error("APK 更新清单无效");
  const directory = `${BlobUtil.fs.dirs.CacheDir}/shell-apk-updates`;
  const file = `${directory}/${apk.sha256}.apk`;
  const temporary = `${file}.part`;
  const report = (phase: ApkProgress["phase"], received = apk.bytes) => onProgress?.({ sha256: apk.sha256, phase, received, total: apk.bytes });
  const valid = async (path: string) => {
    if (!await BlobUtil.fs.exists(path)) return false;
    const stat = await BlobUtil.fs.stat(path);
    return Number(stat.size) === apk.bytes;
  };
  report("verifying", 0);
  if (!await BlobUtil.fs.exists(directory)) await BlobUtil.fs.mkdir(directory);
  if (!await valid(file)) {
    // Only one complete APK and its temporary download are kept on the device.
    for (const name of await BlobUtil.fs.ls(directory)) {
      if (/^[a-f0-9]{64}\.apk(?:\.part)?$/.test(name)) await BlobUtil.fs.unlink(`${directory}/${name}`).catch(() => {});
    }
    report("downloading", 0);
    try {
      const response = await BlobUtil.config({ path: temporary, timeout: 300000 }).fetch("GET", apk.url)
        .progress({ interval: 250 }, received => report("downloading", Math.min(apk.bytes, Math.max(0, Number(received) || 0))));
      if (response.info().status !== 200) throw new Error("安装包下载失败，请重试");
      report("verifying");
      if (!await valid(temporary)) throw new Error("安装包下载不完整，请重新下载");
      await BlobUtil.fs.mv(temporary, file);
    } catch (error) {
      await BlobUtil.fs.unlink(temporary).catch(() => {});
      throw error instanceof Error ? error : new Error("安装包下载失败，请重试");
    }
  }
  report("installing");
  const result = JSON.parse(await NativePluginHost.call("shell", "installPackage", JSON.stringify({ path: file }))) as { ok?: boolean; message?: string; error?: string };
  if (!result.ok) throw new Error(result.message || result.error || "无法打开安装界面，请重试");
  report("ready");
}
