import React, { useRef } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { JollyVideoPlayer, type JollyVideoState } from "./video";
import { theme, themedStyleSheet, useTheme } from "@zijinhua/app-sdk/ui";

export type JollyState = JollyVideoState;
export type JollySize = "avatar" | "sm" | "md" | "lg" | "hero";

const JOLLY_META: Record<
  JollyState,
  { label: string; defaultBubble: string }
> = {
  idle: {
    label: "待机陪伴",
    defaultBubble: "今天想和我一起做出什么好玩的小工具呢？✨",
  },
  waking: {
    label: "元气苏醒",
    defaultBubble: "收到你的心愿！揉揉眼睛，马上准备开工啦~",
  },
  working: {
    label: "专注编写",
    defaultBubble: "戴上耳机进入心流，正在为你编写每一行代码…",
  },
  making: {
    label: "灵感汇聚",
    defaultBubble: "灵感光球凝聚中！正在为你调制界面魔法…",
  },
  level_up: {
    label: "心愿达成",
    defaultBubble: "当当当！你的新工具已经诞生，快来试试吧 ✨",
  },
};

const SIZE_MAP: Record<JollySize, { size: number; radius: number; bubbleMaxW: number }> = {
  avatar: { size: 36, radius: 18, bubbleMaxW: 130 },
  sm: { size: 60, radius: 20, bubbleMaxW: 160 },
  md: { size: 84, radius: 24, bubbleMaxW: 220 },
  lg: { size: 104, radius: 28, bubbleMaxW: 240 },
  hero: { size: 116, radius: 30, bubbleMaxW: 260 },
};

export function JollyCompanion({
  state = "idle",
  size = "md",
  bubbleText,
  showBubble = true,
  onPress,
  style,
}: {
  state?: JollyState;
  size?: JollySize;
  bubbleText?: string;
  showBubble?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const meta = JOLLY_META[state] || JOLLY_META.idle;
  const config = SIZE_MAP[size] || SIZE_MAP.md;

  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.94,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    }).start();
  };

  const bubbleDisplay = bubbleText ?? (size !== "avatar" && showBubble ? meta.defaultBubble : undefined);

  return (
    <View style={[styles.wrapper, style]}>
      {/* 气泡对话框 (Jolly 说话) */}
      {bubbleDisplay ? (
        <View style={[styles.bubbleContainer, { maxWidth: config.bubbleMaxW }]}>
          <View style={styles.bubble}>
            <Text style={styles.bubbleText} numberOfLines={3}>
              {bubbleDisplay}
            </Text>
            {/* 气泡小尖角 */}
            <View style={styles.bubbleTail} />
          </View>
        </View>
      ) : null}

      {/* Jolly 角色本体 (原生 MP4 播放，静止无上下浮动，无底部底座包边) */}
      <Pressable
        onPress={onPress}
        onPressIn={onPress ? handlePressIn : undefined}
        onPressOut={onPress ? handlePressOut : undefined}
        disabled={!onPress}
      >
        <Animated.View
          style={[
            styles.characterBox,
            {
              width: config.size,
              height: config.size,
              borderRadius: config.radius,
              overflow: "hidden",
              transform: [{ scale }],
            },
          ]}
        >
          <JollyVideoPlayer
            state={state}
            width={config.size}
            height={config.size}
            borderRadius={config.radius}
            resizeMode="cover"
          />
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleContainer: {
    marginBottom: 6,
    alignItems: "center",
  },
  bubble: {
    position: "relative",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: 1,
    borderColor: theme.lineStrong,
    shadowColor: theme.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  bubbleText: {
    fontSize: 12,
    lineHeight: 16.5,
    color: theme.ink1,
    fontWeight: "600",
    textAlign: "center",
  },
  bubbleTail: {
    position: "absolute",
    bottom: -5,
    left: "50%",
    marginLeft: -4,
    width: 8,
    height: 8,
    backgroundColor: theme.surfaceRaised,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.lineStrong,
    transform: [{ rotate: "45deg" }],
  },
  characterBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
}));
