import { useEffect, useState } from "react";
import * as Keychain from "react-native-keychain";
import { launchImageLibrary } from "react-native-image-picker";
import BlobUtil from "react-native-blob-util";
import { edgeUrl } from "./evolveHost";
import { readShellValue, removeShellValue, writeShellValue } from "./shellStorage";

export type Account = { id: string; email: string; name: string; avatarUrl: string | null; createdAt: number };
type Credential = { token: string; expiresAt: number };
type State = { user: Account | null; ready: boolean; storageError: boolean };
const service = "com.zijinhua.account";
const cacheKey = "account.profile";
let credential: Credential | null = null;
let state: State = { user: null, ready: false, storageError: false };
let initialization: Promise<void> | undefined;
const listeners = new Set<(value: State) => void>();
function emit(value: State) { state = value; listeners.forEach(listener => listener(value)); }
function remember(user: Account) { writeShellValue(cacheKey, JSON.stringify(user)); emit({ user, ready: true, storageError: false }); }
async function clearAccount() {
  // Never report a successful logout while the persistent credential remains.
  await Keychain.resetGenericPassword({ service });
  credential = null; removeShellValue(cacheKey); emit({ user: null, ready: true, storageError: false });
}
async function initialize() {
  if (!initialization) initialization = (async () => {
    try {
      const stored = await Keychain.getGenericPassword({ service });
      if (stored) {
        const value = JSON.parse(stored.password) as Credential;
        if (/^[a-f0-9]{64}$/.test(value.token) && value.expiresAt > Date.now()) credential = value;
        else await clearAccount();
      }
      const cached = credential ? await readShellValue(cacheKey) : undefined;
      let user: Account | null = null;
      try { if (cached) user = JSON.parse(cached) as Account; } catch { removeShellValue(cacheKey); }
      emit({ user, ready: true, storageError: false });
    } catch { credential = null; emit({ user: null, ready: true, storageError: true }); }
  })();
  await initialization;
}
let refreshStarted = false;
export function useAccount() {
  const [value, setValue] = useState(state);
  useEffect(() => {
    listeners.add(setValue); setValue(state);
    void initialize().then(() => {
      if (credential && !refreshStarted) {
        refreshStarted = true; const token = credential.token;
        void call<{ user: Account }>("/v1/account", "GET").then(result => { if (credential?.token === token) remember(result.user); }).catch(() => {});
      }
    });
    return () => { listeners.delete(setValue); };
  }, []);
  return value;
}
async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  await initialize();
  if (credential && credential.expiresAt <= Date.now()) await clearAccount();
  const token = credential?.token;
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${edgeUrl}${path}`, { method, signal: controller.signal, headers: { "Content-Type": "application/json", ...(credential ? { Authorization: `Bearer ${credential.token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json() as T & { message?: string };
    if (response.status === 401 && credential?.token === token) await clearAccount();
    if (!response.ok) throw new Error(result.message || "操作未完成，请稍后重试");
    return result;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("连接超时，请稍后重试");
    throw error;
  } finally { clearTimeout(timer); }
}
export function sendLoginCode(email: string) { return call<{ retryAfter: number }>("/v1/auth/code", "POST", { email }); }
export async function loginWithCode(email: string, code: string) {
  const result = await call<{ user: Account; token: string; expiresAt: number }>("/v1/auth/verify", "POST", { email, code });
  const value = { token: result.token, expiresAt: result.expiresAt };
  try {
    const saved = await Keychain.setGenericPassword("session", JSON.stringify(value), { service, accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
    if (!saved) throw new Error("storage");
  } catch {
    // Revoke the newly issued session if the phone cannot keep it securely.
    await fetch(`${edgeUrl}/v1/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${result.token}` } }).catch(() => {});
    throw new Error("无法保存登录凭证，请检查手机安全存储后重试");
  }
  credential = value; remember(result.user);
}
export async function saveAccountName(name: string) { const result = await call<{ user: Account }>("/v1/account", "PATCH", { name }); remember(result.user); }
export async function removeAccountAvatar() { const result = await call<{ user: Account }>("/v1/account/avatar", "DELETE"); remember(result.user); }
export async function chooseAccountAvatar() {
  const selection = await launchImageLibrary({ mediaType: "photo", selectionLimit: 1, maxWidth: 512, maxHeight: 512, quality: 0.8 });
  if (selection.didCancel) return;
  if (selection.errorCode || !selection.assets?.[0]?.uri) throw new Error("未能读取图片，请重新选择");
  const asset = selection.assets[0];
  if ((asset.fileSize || 0) > 1048576) throw new Error("请选择小于 1 MB 的图片");
  await initialize();
  if (!credential || credential.expiresAt <= Date.now()) { await clearAccount(); throw new Error("请先登录"); }
  const result = await BlobUtil.config({ timeout: 20000 }).fetch("PUT", `${edgeUrl}/v1/account/avatar`, { Authorization: `Bearer ${credential.token}`, "Content-Type": asset.type || "image/jpeg" }, BlobUtil.wrap(asset.uri!.replace(/^file:\/\//, "")));
  const status = result.info().status;
  const body = result.json() as { user: Account; message?: string };
  if (status === 401) await clearAccount();
  if (status < 200 || status >= 300) throw new Error(body.message || "头像上传失败，请重试");
  remember(body.user);
}
export async function logoutAccount() {
  await call("/v1/auth/logout", "POST");
  await clearAccount();
}
