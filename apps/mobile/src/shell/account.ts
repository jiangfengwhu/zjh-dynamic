import { useEffect, useState } from "react";
import * as Keychain from "react-native-keychain";
import ImagePicker from "react-native-image-crop-picker";
import BlobUtil from "react-native-blob-util";

import { edgeUrl } from "./evolveHost";
import { writePackageValue } from "../../../../packages/ui/packageLink";
import { readShellValue, removeShellValue, writeShellValue } from "./shellStorage";
import { setApplicationAccountScope } from "../../../../packages/app-sdk/src/runtime";

export type Account = { id: string; email: string | null; name: string; avatarUrl: string | null; createdAt: number };
type Credential = { token: string; expiresAt: number };
type State = { user: Account | null; ready: boolean; storageError: boolean };
const service = "com.zijinhua.account";
const cacheKey = "account.profile";
let credential: Credential | null = null;
let state: State = { user: null, ready: false, storageError: false };
let initialization: Promise<void> | undefined;
const listeners = new Set<(value: State) => void>();
const identityListeners = new Set<(id: string | null) => void>();
export function subscribeAccountIdentity(listener: (id: string | null) => void) { identityListeners.add(listener); return () => { identityListeners.delete(listener); }; }
function emit(value: State) { const changed = state.user?.id !== value.user?.id; state = value; setApplicationAccountScope(value.user?.id ?? null); listeners.forEach(listener => listener(value)); if (changed) identityListeners.forEach(listener => listener(value.user?.id ?? null)); }
function remember(user: Account) { profileRevision++; writeShellValue(cacheKey, JSON.stringify(user)); emit({ user, ready: true, storageError: false }); }
async function clearAccount() {
  // Never report a successful logout while the persistent credential remains.
  await Keychain.resetGenericPassword({ service });
  profileRevision++; credential = null; removeShellValue(cacheKey); emit({ user: null, ready: true, storageError: false });
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
let profileRevision = 0;
let loginRequest: { promise: Promise<boolean>; resolve: (allowed: boolean) => void } | undefined;
export function finishLoginRequest(allowed: boolean) { const request = loginRequest; loginRequest = undefined; request?.resolve(allowed); }
let refreshStarted = false;
export function useAccount() {
  const [value, setValue] = useState(state);
  useEffect(() => {
    listeners.add(setValue); setValue(state);
    void initialize().then(() => {
      if (credential && !refreshStarted) {
        refreshStarted = true; const token = credential.token; const revision = profileRevision;
        void call<{ user: Account }>("/v1/account", "GET").then(result => { if (credential?.token === token && profileRevision === revision) remember(result.user); }).catch(() => {});
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
    if (token && credential?.token !== token) throw new Error("账号已改变，请重试");
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
export async function chooseAccountAvatar(onStatus: (message: string) => void): Promise<boolean> {
  const ownerId = await currentAccountId(); if (!ownerId || !credential) throw new Error("请先登录");
  const token = credential.token; let path: string | undefined;
  try {
    onStatus("选择照片并调整圆形取景框");
    const image = await ImagePicker.openPicker({ mediaType: "photo", cropping: true, cropperCircleOverlay: true, width: 512, height: 512, compressImageMaxWidth: 512, compressImageMaxHeight: 512, compressImageQuality: 0.78, forceJpg: true, cropperToolbarTitle: "调整头像", cropperChooseText: "保存头像", cropperCancelText: "取消" });
    path = image.path;
    if (await currentAccountId() !== ownerId || credential?.token !== token) throw new Error("账号已改变，请重试");
    if (!path || !image.size || image.size > 1048576) throw new Error("头像处理失败或图片过大，请重新选择");
    onStatus("正在上传头像到云端…");
    const response = await BlobUtil.config({ timeout: 20000 }).fetch("PUT", `${edgeUrl}/v1/account/avatar`, { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" }, BlobUtil.wrap(path.replace(/^file:\/\//, "")));
    if (credential?.token !== token) throw new Error("账号已改变，请重试");
    const status = response.info().status;
    if (status === 401) { await clearAccount(); throw new Error("登录已失效，请重新登录"); }
    let body: { user?: Account; message?: string };
    try { body = response.json(); } catch { throw new Error("头像上传失败，请检查网络后重试"); }
    if (status < 200 || status >= 300) throw new Error(body.message || "头像上传失败，请重试");
    if (!body.user?.avatarUrl || body.user.id !== ownerId) throw new Error("头像保存结果无效，请重试");
    remember(body.user); return true;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "E_PICKER_CANCELLED") return false;
    if (code === "E_NO_LIBRARY_PERMISSION") throw new Error("请允许访问相册后重试");
    throw new Error(error instanceof Error ? error.message : "头像更换失败，请重试");
  } finally { if (path) await ImagePicker.cleanSingle(path).catch(() => {}); }
}
export async function logoutAccount() {
  await call("/v1/auth/logout", "POST");
  await clearAccount();
}
/** Native file transport stays in the host; plugin contexts never receive tokens. */
export async function uploadPostImage(path: string): Promise<{ id: string; url: string }> {
  if (!await requireAccount(false) || !credential) throw new Error("请先登录");
  const token = credential.token;
  const response = await BlobUtil.config({ timeout: 60000 }).fetch("PUT", `${edgeUrl}/v1/post-media`, { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" }, BlobUtil.wrap(path.replace(/^file:\/\//, "")));
  if (credential?.token !== token) throw new Error("账号已改变，请重试");
  const status = response.info().status;
  if (status === 401) { await clearAccount(); throw new Error("登录已失效，请重新登录"); }
  let result: { image?: { id: string; url: string }; message?: string };
  try { result = response.json(); } catch { throw new Error("图片上传失败，请重试"); }
  if (status < 200 || status >= 300 || !result.image) throw new Error(result.message || "图片上传失败，请重试");
  return result.image;
}
function openLogin() { writePackageValue("shell.nav.request", JSON.stringify({ action: "account", at: Date.now() })); }
export function cachedAccountId(): string | undefined { return state.ready && credential && credential.expiresAt > Date.now() ? state.user?.id : undefined; }
export async function currentAccountId(): Promise<string | undefined> { await initialize(); return cachedAccountId(); }
export async function requireAccount(prompt = true): Promise<boolean> {
  await initialize();
  if (credential && credential.expiresAt <= Date.now()) await clearAccount();
  if (credential) return true;
  if (!prompt) return false;
  if (!loginRequest) {
    let resolve!: (allowed: boolean) => void;
    const promise = new Promise<boolean>(done => { resolve = done; });
    loginRequest = { promise, resolve };
    openLogin();
  }
  return loginRequest.promise;
}
/** Private host transport: credentials never enter plugin contexts or application storage. */
export async function accountFetch(url: string, options: RequestInit, prompt = true): Promise<Response> {
  if (!await requireAccount(prompt)) throw new Error("请先登录后再操作作品");
  const token = credential!.token; const headers = new Headers(options.headers); headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...options, headers });
  if (credential?.token !== token) throw new Error("账号已改变，请重试");
  if (response.status === 401) { if (credential?.token === token) await clearAccount(); if (prompt) openLogin(); }
  else {
    const readJson = response.json.bind(response), readText = response.text.bind(response);
    response.json = async () => { const result = await readJson(); if (credential?.token !== token) throw new Error("账号已改变，请重试"); return result; };
    response.text = async () => { const result = await readText(); if (credential?.token !== token) throw new Error("账号已改变，请重试"); return result; };
  }
  return response;
}
