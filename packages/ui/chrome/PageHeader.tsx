import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScreenBar } from "../edge";
import { themedStyleSheet, useTheme } from "../theme";
import { Icon } from "./Icon";
import { Pressy } from "./Pressy";

/** 返回键保持 44 点触控区域，与紧凑顶栏对齐。 */
export function BackChip({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel="返回上一级"
      onPress={onPress}
      scale={0.9}
      style={styles.back}
    >
      <Icon name="back" size={20} color={colors.ink1} strokeWidth={1.9} />
    </Pressy>
  );
}

/** 详情与设置共用的紧凑顶栏。 */
export function PageHeader({
  title,
  caption,
  onBack,
  right,
}: {
  title: string;
  caption?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  useTheme();
  return (
    <ScreenBar style={styles.bar}>
      {onBack ? <BackChip onPress={onBack} /> : null}
      <View style={styles.titleBox}>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {caption ? (
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
      {right}
    </ScreenBar>
  );
}

/** 告诉 Screen：状态栏这一段由顶栏自己铺，页面根容器不必再留顶部安全区。 */
PageHeader.providesBar = true;

const styles = themedStyleSheet((t) => ({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: t.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.line,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: t.radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBox: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontFamily: t.serif,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "700",
    color: t.ink1,
    letterSpacing: -0.4,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    color: t.ink3,
  },
}));
