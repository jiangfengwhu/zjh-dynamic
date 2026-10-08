import { Text } from "../../../../packages/ui/primitives/Typography";
import { UserAvatar } from "./UserAvatar";
import { memo, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import Animated, { FadeInDown, ReduceMotion } from "react-native-reanimated";
import { useAccount } from "./account";
import { Screen } from "../../../../packages/ui/edge";
import {
  Icon,
  PageHeader,
  Pressy,
  SectionTitle,
  type IconName,
} from "../../../../packages/ui/chrome";
import { createThemedStyles, useTheme, type ThemeMode } from "../../../../packages/ui/theme";

type CheckState = "idle" | "busy" | "ready" | "current" | "failed";
type Props = {
  drawer?: boolean;
  onClose?: () => void;
  mode: ThemeMode;
  onAccount: () => void;
  onProfile?: () => void;
  onProviders: () => void;
  onInfo: () => void;
  onCheckUpdates: () => Promise<boolean>;
  onAppearance: () => void;
};

export const MineScreen = memo(function MineScreen({
  drawer,
  onClose,
  mode,
  onAccount,
  onProfile,
  onProviders,
  onInfo,
  onCheckUpdates,
  onAppearance,
}: Props) {
  const styles = useStyles();

  const { colors } = useTheme();
  const { user } = useAccount();
  const [check, setCheck] = useState<CheckState>("idle");
  async function checkUpdates() {
    if (check === "busy") return;
    setCheck("busy");
    try {
      setCheck((await onCheckUpdates()) ? "ready" : "current");
    } catch {
      setCheck("failed");
    }
  }
  return (
    <Screen style={styles.screen}>
      {!drawer ? (
        <PageHeader
          title="设置"
          right={
            onClose ? (
              <Pressy
                accessibilityRole="button"
                accessibilityLabel="关闭我的抽屉"
                onPress={onClose}
                style={{
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="close" size={20} color={colors.ink1} />
              </Pressy>
            ) : undefined
          }
        />
      ) : null}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(220).reduceMotion(ReduceMotion.System)}
        >
          <Pressy
            accessibilityLabel={user ? "查看我的主页" : "邮箱登录"}
            onPress={user ? onProfile : onAccount}
            style={styles.profile}
          >
            <UserAvatar uri={user?.avatarUrl} size={52} style={styles.portrait} />
            <View style={styles.profileCopy}>
              <Text numberOfLines={2} style={styles.profileName}>
                {user?.name ?? "登录账号"}
              </Text>
              {!user ? <Text style={styles.profileHint}>邮箱验证码登录，开始创作</Text> : null}
            </View>
            <Icon name="chevron" size={15} color={colors.ink3} />
          </Pressy>
        </Animated.View>
        <View style={styles.shortcuts}>
          <Shortcut
            icon="engine"
            title="AI 引擎"
            hint="管理模型与连接"
            onPress={onProviders}
          />
        </View>
        <SectionTitle>偏好与工具</SectionTitle>
        <View style={styles.group}>
          <Row
            icon={mode === "dark" ? "moon" : "sun"}
            title="外观"
            hint="浅色、深色与跟随系统"
            value={mode === "dark" ? "深色" : "浅色"}
            onPress={onAppearance}
          />
          <Row
            icon="cloud"
            title="检查更新"
            hint={check === "busy" ? "正在核对线上版本" : "每 30 分钟自动检查"}
            value={checkLabel(check)}
            warn={check === "failed"}
            disabled={check === "busy"}
            onPress={() => void checkUpdates()}
          />
          <Row
            icon="info"
            title="应用信息"
            hint="版本与本机安装信息"
            onPress={onInfo}
            last
          />
        </View>
        {drawer && onClose ? (
          <Pressy
            accessibilityRole="button"
            accessibilityLabel="收起我的抽屉"
            onPress={onClose}
            style={{
              minHeight: 44,
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Icon name="back" size={18} color={colors.ink3} />
            <Text style={{ fontSize: 12, color: colors.ink3 }}>收起</Text>
          </Pressy>
        ) : null}
      </ScrollView>
    </Screen>
  );
});
function Shortcut({
  icon,
  title,
  hint,
  onPress,
  primary = false,
}: {
  icon: IconName;
  title: string;
  hint: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const styles = useStyles();

  const { colors } = useTheme();
  return (
    <Pressy
      onPress={onPress}
      style={[
        styles.shortcut,
        primary && {
          backgroundColor: colors.accentTint,
          borderColor: colors.accentSoft,
        },
      ]}
    >
      <View style={styles.shortcutHead}>
        <Icon
          name={icon}
          size={22}
          color={primary ? colors.accentText : colors.ink1}
        />
        <Icon name="chevron" size={15} color={colors.ink3} />
      </View>
      <Text style={styles.shortcutTitle}>{title}</Text>
      <Text style={styles.rowHint}>{hint}</Text>
    </Pressy>
  );
}
function Row({
  icon,
  title,
  hint,
  value,
  warn,
  last,
  disabled,
  onPress,
}: {
  icon: IconName;
  title: string;
  hint: string;
  value?: string;
  warn?: boolean;
  last?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();

  const { colors } = useTheme();
  return (
    <Pressy
      disabled={disabled}
      onPress={onPress}
      style={[styles.row, !last && styles.divider]}
    >
      <Icon name={icon} size={19} color={colors.ink2} />
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text numberOfLines={1} style={styles.rowHint}>
          {hint}
        </Text>
      </View>
      {value ? (
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.rowValue, warn && { color: colors.redText }]}
        >
          {value}
        </Text>
      ) : null}
      <Icon name="chevron" size={15} color={colors.ink3} />
    </Pressy>
  );
}
function checkLabel(state: CheckState): string | undefined {
  return (
    {
      busy: "检查中",
      ready: "有更新",
      current: "已是最新",
      failed: "重试",
    } as Partial<Record<CheckState, string>>
  )[state];
}
const useStyles = createThemedStyles((t) => ({
  screen: { backgroundColor: t.canvas },
  content: { padding: 20, paddingTop: 16, gap: 20, paddingBottom: 24 },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: t.amberTint,
  },
  portrait: { width: 52, height: 52, borderRadius: 26 },
  profileCopy: { flex: 1, minWidth: 0, gap: 4 },
  profileName: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
    fontWeight: "800",
    color: t.ink1,
  },
  profileHint: { fontSize: 12, lineHeight: 18, color: t.ink3 },
  shortcuts: { flexDirection: "row", gap: 8 },
  shortcut: {
    flex: 1,
    minWidth: 0,
    padding: 18,
    gap: 6,
    borderRadius: t.radius.md,
    borderWidth: 0.5,
    borderColor: t.line,
    backgroundColor: t.cyanTint,
  },
  shortcutHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  shortcutTitle: {
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
    color: t.ink1,
  },
  group: {
    backgroundColor: t.surface,
    borderRadius: t.radius.md,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
  },
  divider: { borderBottomWidth: 0.5, borderBottomColor: t.line },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 14, lineHeight: 20, fontWeight: "600", color: t.ink1 },
  rowHint: { fontSize: 11, lineHeight: 16, color: t.ink3 },
  rowValue: {
    maxWidth: "30%",
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    color: t.accentText,
  },
}));
