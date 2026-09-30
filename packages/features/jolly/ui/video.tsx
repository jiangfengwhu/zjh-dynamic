import { getAppContext } from "@zijinhua/app-sdk";
import React, { useMemo } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Video, { ViewType } from "react-native-video";

export type JollyVideoState =
  | "idle"
  | "waking"
  | "working"
  | "making"
  | "level_up";

export interface JollyVideoProps {
  state?: JollyVideoState;
  src?: string;
  width?: number;
  height?: number;
  repeat?: boolean;
  muted?: boolean;
  resizeMode?: "cover" | "contain";
  borderRadius?: number;
  still?: boolean;
  style?: ViewStyle;
}

const STATE_TO_VIDEO: Record<JollyVideoState, string> = {
  idle: "jolly_idle",
  waking: "jolly_waking",
  working: "jolly_working",
  making: "jolly_making_something",
  level_up: "jolly_milestone_level_up",
};

/** 完整地址原样用；只给名字（jolly_idle 或 jolly_idle.mp4）就取 App 自带的 assets/jolly/<名字>.mp4。 */
function sourceOf(name: string): { uri: string } {
  if (/^(https?|file|asset):\/\//.test(name)) return { uri: name };
  const clean = name.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase();
  return { uri: getAppContext().assets.uri(`${clean}.mp4`) };
}

export function JollyVideoPlayer({
  state = "idle",
  src,
  width = 84,
  height = 84,
  repeat = true,
  muted = true,
  resizeMode = "cover",
  borderRadius,
  still = false,
  style,
}: JollyVideoProps) {
  const source = useMemo(() => sourceOf(src || STATE_TO_VIDEO[state] || STATE_TO_VIDEO.idle), [src, state]);

  return (
    <View style={[{ width, height, borderRadius, overflow: "hidden", backgroundColor: "#FAF8F5" }, style]}>
      <Video
        source={source}
        style={StyleSheet.absoluteFill}
        // 画面是不透明的，用 texture 才能被外层的圆角裁剪。
        viewType={ViewType.TEXTURE}
        resizeMode={resizeMode}
        repeat={repeat}
        muted={muted}
        // 定格时停在第一帧，不播放。
        paused={still}
        // 静音的装饰视频不去抢音频焦点，也不在后台继续播。
        disableFocus
        playInBackground={false}
        onError={(error) => console.log("jolly video error", source.uri, JSON.stringify(error))}
      />
    </View>
  );
}
