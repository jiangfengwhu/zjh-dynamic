import { LoadingSkeleton } from "./LoadingSkeleton";
import { PixelAlert as Alert } from "./PixelAlert";
import { useEffect, useRef, useState } from "react";
import { useRouteContentReady } from "./useRouteContentReady";
import { Image, Text, View } from "react-native";
import { KeyboardAwareScrollView as ScrollView } from "react-native-keyboard-controller";
import { FormField as TextInput } from "./FormField";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { themedStyleSheet, useTheme } from "../../../../packages/ui/theme";
import Toast from "react-native-toast-message";
const toast = { success: (text: string) => Toast.show({ type: "success", text1: text }), error: (text: string) => Toast.show({ type: "error", text1: "操作未完成", text2: text, visibilityTime: 5000 }) };
import { finishLoginRequest, chooseAccountAvatar, loginWithCode, logoutAccount, removeAccountAvatar, saveAccountName, sendLoginCode, useAccount } from "./account";

export function AccountScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const { user, ready, storageError } = useAccount();
  const contentReady = useRouteContentReady();
  const [email, setEmail] = useState(""); const [code, setCode] = useState(""); const [name, setName] = useState(user?.name || "");
  const [retryAt, setRetryAt] = useState(0); const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false); const busyRef = useRef(false); const [message, setMessage] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const alive = useRef(true); const loginSucceeded = useRef(false);
  const normalizedEmail = email.trim().toLowerCase(); const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const validEmail = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(normalizedEmail) && normalizedEmail.length <= 254;
  useEffect(() => { setName(user?.name || ""); setMessage(""); }, [user?.id, user?.name]);
  useEffect(() => { if (!remaining || user) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [remaining > 0, !!user]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (!loginSucceeded.current) finishLoginRequest(false); }; }, []);
  async function perform(action: () => Promise<void | boolean>, success = "") {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setMessage("");
    try { const changed = await action(); if (alive.current && changed !== false) { setMessage(success); if (success) toast.success(success); } }
    catch (error) { const detail = error instanceof Error ? error.message : "操作未完成，请稍后重试"; if (alive.current) { setMessage(detail); toast.error(detail); } }
    finally { busyRef.current = false; if (alive.current) { setBusy(false); setUploadStatus(""); } }
  }
  const button = (label: string, action: () => void, disabled = false, secondary = false) => (
    <Pressy accessibilityRole="button" accessibilityState={{ disabled: busy || disabled }} disabled={busy || disabled} onPress={action} style={[styles.button, secondary && styles.secondary, label === "退出登录" && styles.logout, (busy || disabled) && styles.disabled]}>
      <Text style={[secondary ? styles.secondaryLabel : styles.buttonLabel, label === "退出登录" && styles.logoutLabel]}>{label}</Text>
    </Pressy>
  );
  return <Screen style={styles.screen}>
    <PageHeader title={user ? "个人资料" : "邮箱登录"} caption={user ? "让大家认识你" : "一封邮件，就能回来"} onBack={onBack} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!ready || !contentReady ? <View accessibilityLabel="正在准备个人资料" style={styles.panel}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.inset }} />
        <View style={{ width: "50%", height: 18, borderRadius: 4, backgroundColor: colors.inset }} />
        <View style={{ height: 48, borderRadius: 12, backgroundColor: colors.inset }} />
      </View> : user ? <>
        <View style={styles.panel}>
          <View style={styles.avatarRow}>
            {user.avatarUrl ? <Image key={user.avatarUrl} source={{ uri: user.avatarUrl }} style={styles.avatar} onError={() => toast.error("头像加载失败，请检查网络后重试")} /> : <View style={[styles.avatar, styles.placeholder]}><Text style={styles.initial}>{Array.from(user.name)[0]}</Text></View>}
            <View style={styles.fill}><Text style={styles.label}>你的头像</Text><Text style={styles.hint}>从相册选择一张喜欢的照片</Text></View>
          </View>
          {button("更换头像", () => void perform(() => chooseAccountAvatar(setUploadStatus), "头像已更新"), false, true)}
          {user.avatarUrl ? button("恢复默认头像", () => void perform(removeAccountAvatar, "已恢复默认头像"), false, true) : null}
          <Text style={styles.label}>昵称</Text>
          <TextInput accessibilityLabel="昵称" value={name} onChangeText={setName} editable={!busy} maxLength={48} placeholder="给自己取个好听的名字" placeholderTextColor={colors.muted} style={styles.input} />
          <Text style={styles.hint}>最多 24 个字符</Text>
          {button("保存昵称", () => void perform(() => saveAccountName(name), "昵称已保存"), !name.trim() || Array.from(name.trim()).length > 24 || name.trim() === user.name)}
          <Text style={styles.label}>登录邮箱</Text><Text selectable style={styles.hint}>{user.email}</Text>
        </View>
        {button("退出登录", () => Alert.alert("退出登录？", "下次可用邮箱验证码重新登录。", [{ text: "取消", style: "cancel" }, { text: "退出登录", style: "destructive", onPress: () => void perform(logoutAccount) }]), false, true)}
      </> : <View style={styles.panel}>
        <Text style={styles.label}>邮箱地址</Text>
        <TextInput accessibilityLabel="邮箱地址" value={email} onChangeText={value => { setEmail(value); setCode(""); }} editable={!busy} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" autoComplete="email" maxLength={254} placeholder="你的常用邮箱" placeholderTextColor={colors.muted} style={styles.input} />
        {button(remaining ? `${remaining} 秒后重新发送` : "发送验证码", () => void perform(async () => { const result = await sendLoginCode(normalizedEmail); setCode(""); setNow(Date.now()); setRetryAt(Date.now() + result.retryAfter * 1000); }, "验证码已发送，请查看邮箱"), !validEmail || remaining > 0, true)}
        {retryAt > 0 ? <><Text style={styles.label}>六位验证码</Text>
        <TextInput accessibilityLabel="六位验证码" value={code} onChangeText={value => setCode(value.replace(/\D/g, ""))} editable={!busy} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} placeholder="输入邮件中的验证码" placeholderTextColor={colors.muted} style={styles.input} />
        {button(busy ? "请稍候…" : "登录", () => void perform(async () => { await loginWithCode(normalizedEmail, code); if (alive.current) { loginSucceeded.current = true; onBack(); setTimeout(() => finishLoginRequest(true), 220); } }), !validEmail || code.length !== 6)}
        </> : null}
        <Text style={styles.hint}>首次登录自动创建账号。只在创作、发布等操作时需要登录，验证码 10 分钟内有效。</Text>
      </View>}
      {storageError ? <Text accessibilityRole="alert" style={styles.hint}>无法读取手机安全存储，请重新登录。</Text> : null}
      {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
    </ScrollView>
    {busy ? <View pointerEvents="none" style={{ position: "absolute", left: 24, right: 24, bottom: 24, padding: 16, backgroundColor: colors.surfaceRaised, flexDirection: "row", gap: 12, borderRadius: 16 }}><LoadingSkeleton color={colors.accent} /><Text style={{ color: colors.ink1 }}>{uploadStatus || "正在处理，请稍候…"}</Text></View> : null}
  </Screen>;
}
const styles = themedStyleSheet(t => ({
  screen: { flex: 1, backgroundColor: t.canvas }, content: { padding: 16, paddingBottom: 12, gap: 12 },
  panel: { padding: 12, gap: 8, backgroundColor: t.surface, borderRadius: t.radius.md, borderWidth: 0.5, borderColor: t.line }, label: { color: t.ink1, fontSize: 13, fontWeight: "600" },
  hint: { color: t.muted, fontSize: 12, lineHeight: 18 }, message: { color: t.ink1, fontSize: 15, lineHeight: 24 },
  input: { color: t.ink1, backgroundColor: t.field, borderRadius: t.radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, minHeight: 44 },
  button: { backgroundColor: t.accent, borderRadius: t.radius.md, minHeight: 44, padding: 10, alignItems: "center", justifyContent: "center" },
  logout: { backgroundColor: t.redTint }, logoutLabel: { color: t.redText }, secondary: { backgroundColor: t.inset }, disabled: { opacity: 0.45 },
  buttonLabel: { color: t.onAccent, fontSize: 14, fontWeight: "700" }, secondaryLabel: { color: t.accentText, fontSize: 14, fontWeight: "700" },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12 }, fill: { flex: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28 }, placeholder: { backgroundColor: t.accentTint, alignItems: "center", justifyContent: "center" }, initial: { color: t.accentText, fontSize: 20, fontWeight: "600" },
}));
