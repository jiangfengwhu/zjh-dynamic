import posters from "../posters.json";
import { jollyAssets } from "../assets";
import { bundleR2Url } from "../../evolveHost";
import { useEffect, useMemo, useState } from "react";
import { AppState, Image, StyleSheet, View, ViewStyle } from "react-native";
import Video, { ViewType } from "react-native-video";
import { useIsFocused } from "@react-navigation/native";

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

/** 固定哈希视频来自宿主媒体 CDN；对应首帧直接内置在主包里。 */
function sourceOf(name: string): { uri: string } {
  if (/^(https?|file|asset):\/\//.test(name)) return { uri: name };
  const clean = name
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
  return {
    uri: `${bundleR2Url}/v1/app/${
      jollyAssets[clean as keyof typeof jollyAssets]
    }`,
  };
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
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === "active");
  const [displayedSource, setDisplayedSource] = useState<{ uri: string }>();
  useEffect(() => {
    const subscription = AppState.addEventListener("change", value => setForeground(value === "active"));
    return () => subscription.remove();
  }, []);
  const videoName = src || STATE_TO_VIDEO[state] || STATE_TO_VIDEO.idle;
  const name = videoName.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase();
  const poster = posters[name as keyof typeof posters] || posters.jolly_idle;
  const source = useMemo(
    () => sourceOf(videoName),
    [videoName]
  );

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          overflow: "hidden",
          backgroundColor: "#FAF8F5",
        },
        style,
      ]}
    >
      <Video
        key={source.uri}
        source={source}
        style={StyleSheet.absoluteFill}
        // 画面是不透明的，用 texture 才能被外层的圆角裁剪。
        viewType={ViewType.TEXTURE}
        shutterColor="transparent"
        onReadyForDisplay={() => setDisplayedSource(source)}
        resizeMode={resizeMode}
        repeat={repeat}
        muted={muted}
        // 定格时停在第一帧，不播放。
        paused={still || !focused || !foreground}
        // 静音的装饰视频不去抢音频焦点，也不在后台继续播。
        disableFocus
        playInBackground={false}
        onError={(error) => {
          setDisplayedSource(undefined);
          console.log("jolly video error", source.uri, JSON.stringify(error));
        }}
      />
      {displayedSource !== source ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image source={{ uri: poster }} resizeMode={resizeMode} style={StyleSheet.absoluteFill} />
        </View>
      ) : null}
    </View>
  );
}
