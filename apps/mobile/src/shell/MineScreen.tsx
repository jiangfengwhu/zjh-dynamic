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
            tile={colors.amberTint}
            tint={colors.amberText}
            title="外观"
            hint="浅色、深色与跟随系统"
            value={mode === "dark" ? "深色" : "浅色"}
            onPress={onAppearance}
          />
          <Row
            icon="cloud"
            tile={colors.cyanTint}
            tint={colors.cyanText}
            title="检查更新"
            hint={check === "busy" ? "正在核对线上版本" : "每 30 分钟自动检查"}
            value={checkLabel(check)}
            warn={check === "failed"}
            disabled={check === "busy"}
            onPress={() => void checkUpdates()}
          />
          <Row
            icon="info"
            tile={colors.greenTint}
            tint={colors.greenText}
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
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink3 }}>收起</Text>
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
        <View style={[styles.shortcutTile, primary && { backgroundColor: colors.accent }]}>
          <Icon
            name={icon}
            size={20}
            color={primary ? colors.onAccent : colors.accentText}
          />
        </View>
        <Icon name="chevron" size={15} color={colors.ink3} />
      </View>
      <Text style={styles.shortcutTitle}>{title}</Text>
      <Text style={styles.rowHint}>{hint}</Text>
    </Pressy>
  );
}
function Row({
  icon,
  tile,
  tint,
  title,
  hint,
  value,
  warn,
  last,
  disabled,
  onPress,
}: {
  icon: IconName;
  tile?: string;
  tint?: string;
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
      <View style={[styles.rowTile, { backgroundColor: tile ?? colors.surfaceRaised }]}>
        <Icon name={icon} size={18} color={tint ?? colors.ink2} />
      </View>
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
  content: { padding: 16, paddingTop: 16, gap: 16, paddingBottom: 24 },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: t.radius.xl,
    backgroundColor: t.surface,
    borderWidth: t.components.surfaceBorder,
    borderColor: t.line,
  },
  portrait: { width: 56, height: 56, borderRadius: 28 },
  profileCopy: { flex: 1, minWidth: 0, gap: 3 },
  profileName: {
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: -0.4,
    fontWeight: "800",
    color: t.ink1,
  },
  profileHint: { fontSize: 13, lineHeight: 18, color: t.ink3 },
  shortcuts: { flexDirection: "row", gap: 10 },
  shortcut: {
    flex: 1,
    minWidth: 0,
    padding: 16,
    gap: 2,
    borderRadius: t.radius.xl,
    borderWidth: t.components.surfaceBorder,
    borderColor: t.line,
    backgroundColor: t.surface,
  },
  shortcutHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  shortcutTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: t.accentTint,
  },
  shortcutTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    color: t.ink1,
  },
  group: {
    backgroundColor: t.surface,
    borderRadius: t.radius.xl,
    borderWidth: t.components.surfaceBorder,
    borderColor: t.line,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
  },
  rowTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: { borderBottomWidth: t.components.surfaceBorder, borderBottomColor: t.line },
  rowCopy: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { fontSize: 15, lineHeight: 21, fontWeight: "600", color: t.ink1 },
  rowHint: { fontSize: 12, lineHeight: 17, color: t.ink3 },
  rowValue: {
    maxWidth: "30%",
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    color: t.ink3,
  },
}));
