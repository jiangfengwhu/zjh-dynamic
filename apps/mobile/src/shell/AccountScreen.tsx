import { Text } from "../../../../packages/ui/primitives/Typography";
import { UserAvatar } from "./UserAvatar";
import { ActivityIndicator } from "react-native";
import { HostAlert as Alert } from "./HostAlert";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { KeyboardAwareScrollView as ScrollView } from "react-native-keyboard-controller";
import { FormField as TextInput } from "./FormField";
import { PageHeader, Pressy } from "../../../../packages/ui/chrome";
import { Screen } from "../../../../packages/ui/edge";
import { createThemedStyles, useTheme } from "../../../../packages/ui/theme";
import { notify as Toast } from "../../../../packages/ui/feedback/Toasts";
const toast = { success: (text: string) => Toast.show({ type: "success", text1: text }), error: (text: string) => Toast.show({ type: "error", text1: "操作未完成", text2: text, visibilityTime: 5000 }) };
import { finishLoginRequest, chooseAccountAvatar, loginWithCode, logoutAccount, removeAccountAvatar, saveAccountName, sendLoginCode, useAccount } from "./account";

export function AccountScreen({ onBack }: { onBack: () => void }) {
  const styles = useStyles();

  const { colors } = useTheme();
  const { user, ready, storageError } = useAccount();
  const { watch, setValue } = useForm({ defaultValues: { email: "", code: "", name: user?.name || "" } });
  const [email, code, name] = watch(["email", "code", "name"]);
  const setEmail = (value: string) => setValue("email", value);
  const setCode = (value: string) => setValue("code", value);
  const setName = (value: string) => setValue("name", value);
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
      {!ready ? <View accessibilityLabel="正在准备个人资料" style={styles.panel}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceRaised }} />
        <View style={{ width: "50%", height: 18, borderRadius: 9, backgroundColor: colors.surfaceRaised }} />
        <View style={{ height: 44, borderRadius: 12, backgroundColor: colors.surfaceRaised }} />
      </View> : user ? <>
        <View style={styles.panel}>
          <View style={styles.avatarRow}>
            <UserAvatar uri={user.avatarUrl} size={52} style={styles.avatar} onError={avatarError} />
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
    {busy ? <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: 20, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: colors.dock, flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 18, boxShadow: colors.shadow.float }}><ActivityIndicator color={colors.onDock} /><Text style={{ color: colors.onDock, fontWeight: "600" }}>{uploadStatus || "正在处理，请稍候…"}</Text></View> : null}
  </Screen>;
}
const useStyles = createThemedStyles(t => ({
  screen: { flex: 1, backgroundColor: t.canvas }, content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20, gap: 12 },
  panel: { padding: 14, gap: 10, backgroundColor: t.surface, borderRadius: t.radius.xl, borderWidth: t.mode === "dark" ? t.components.surfaceBorder : 0, borderColor: t.line, boxShadow: t.shadow.card },
  label: { color: t.ink2, fontSize: 13, lineHeight: 18, fontWeight: "600", paddingHorizontal: 4, marginTop: 4 },
  hint: { color: t.muted, fontSize: 13, lineHeight: 19, paddingHorizontal: 4 }, message: { color: t.ink1, fontSize: 15, lineHeight: 24 },
  input: { color: t.ink1, backgroundColor: t.surfaceRaised, borderRadius: t.components.controlRadius, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, minHeight: t.components.controlHeight },
  button: { backgroundColor: t.accent, borderRadius: t.radius.pill, minHeight: t.components.controlHeight, paddingHorizontal: 20, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  logout: { backgroundColor: t.redTint }, logoutLabel: { color: t.redText }, secondary: { backgroundColor: t.surfaceRaised }, disabled: { opacity: 0.35 },
  buttonLabel: { color: t.onAccent, fontSize: 15, fontWeight: "700", letterSpacing: -0.1 }, secondaryLabel: { color: t.ink1, fontSize: 14, fontWeight: "700" },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 2 }, fill: { flex: 1, gap: 2 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
}));

function avatarError() { toast.error("头像加载失败，请检查网络后重试"); }
