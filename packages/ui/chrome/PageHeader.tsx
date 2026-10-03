import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ScreenBar } from "../edge";
import { themedStyleSheet, useTheme } from "../theme";
import { Icon } from "./Icon";
import { Pressy } from "./Pressy";

/** 返回键。圆形、发丝边，和页面标题同一行。 */
export function BackChip({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressy
      accessibilityRole="button"
      accessibilityLabel="返回上一级"
      onPress={onPress}
      hitSlop={8}
      scale={0.9}
      style={styles.back}
    >
      <Icon name="back" size={20} color={colors.ink1} strokeWidth={1.9} />
    </Pressy>
  );
}

/** 二级页面的顶栏。标题用衬线，说明放在标题下面，右侧留一个位置给状态或操作。 */
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
        <Text style={styles.title} numberOfLines={1}>
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
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: t.canvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.line,
  },
  back: {
    width: 48,
    height: 48,
    borderRadius: 10,
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
    fontWeight: "600",
    color: t.ink1,
    letterSpacing: 0.2,
  },
  caption: {
    fontSize: 12.5,
    lineHeight: 17,
    color: t.ink3,
  },
}));
