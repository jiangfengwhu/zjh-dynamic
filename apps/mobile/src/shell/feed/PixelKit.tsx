import { useEffect, useState } from "react";
import { AppState, Image, Text, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import Video from "react-native-video";
import RNBlobUtil from "react-native-blob-util";
import { pixelAssets } from "./pixelAssets";

export type PixelSymbol =
  | "plus"
  | "bell"
  | "heart"
  | "chat"
  | "arrow"
  | "spark"
  | "feed"
  | "box"
  | "mine";
const paths: Record<PixelSymbol, string> = {
  plus: "M7 2h2v5h5v2H9v5H7V9H2V7h5z",
  bell: "M6 1h4v2h2v2h1v6h2v2H1v-2h2V5h1V3h2zM5 5v6h6V5H9V3H7v2zM6 14h4v2H6z",
  heart: "M2 3h4v2h4V3h4v2h2v5h-2v2h-2v2h-2v2H6v-2H4v-2H2v-2H0V5h2z",
  chat: "M1 2h14v10H7l-4 3v-3H1zM3 4v6h2v2l2-2h6V4z",
  arrow: "M8 1h2v2h2v2h2v2h2v2h-2v2h-2v2h-2v2H8v-4h2V9H0V7h10V5H8z",
  spark: "M7 0h2v5h2v2h5v2h-5v2H9v5H7v-5H5V9H0V7h5V5h2z",
  feed: "M1 1h14v14H1zM3 3v10h10V3zM5 5h6v2H5zM5 9h4v2H5z",
  box: "M2 2h12v3h2v10H0V5h2zM4 4v2h8V4zM2 8v5h12V8h-4v2H6V8z",
  mine: "M5 1h6v2h2v6h-2v2h3v2h2v3H0v-3h2v-2h3V9H3V3h2zM5 3v6h6V3zM4 13v1h8v-1z",
};
export function PixelIcon({
  name,
  size = 20,
  color,
}: {
  name: PixelSymbol;
  size?: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" accessible={false}>
      <Path d={paths[name]} fill={color} fillRule="evenodd" />
    </Svg>
  );
}

export const mascotImage = {
  uri: `data:image/png;base64,${pixelAssets.avatar.base64}`,
};
export function PixelAvatar({ size = 48 }: { size?: number }) {
  return (
    <Image
      accessible={false}
      source={mascotImage}
      resizeMode="contain"
      style={{ width: size, height: size, backgroundColor: "#FFFFFF" }}
    />
  );
}

type Scene = "working" | "making" | "milestone";
const cache = new Map<Scene, Promise<string>>();
function materialize(scene: Scene) {
  let pending = cache.get(scene);
  if (!pending) {
    pending = (async () => {
      const asset = pixelAssets[scene];
      const path = `${RNBlobUtil.fs.dirs.CacheDir}/pixel-${asset.hash}.mp4`;
      if (!(await RNBlobUtil.fs.exists(path)))
        await RNBlobUtil.fs.writeFile(path, asset.base64, "base64");
      return `file://${path}`;
    })();
    cache.set(scene, pending);
    pending.catch(() => cache.delete(scene));
  }
  return pending;
}

/** One video surface only. No audio, background playback, or scroll-time decoders. */
export function PixelScene({
  scene,
  size = 112,
  playing = true,
}: {
  scene?: Scene;
  size?: number;
  playing?: boolean;
}) {
  const focused = useIsFocused();
  const reduced = useReducedMotion();
  const [active, setActive] = useState(AppState.currentState === "active");
  const [uri, setUri] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setActive(state === "active")
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let current = true;
    setUri(undefined);
    setFailed(false);
    setLoaded(false);
    if (scene && !reduced)
      void materialize(scene).then(
        (value) => {
          if (current) setUri(value);
        },
        () => {
          if (current) setFailed(true);
        }
      );
    return () => {
      current = false;
    };
  }, [scene, reduced]);
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        backgroundColor: "#FFFFFF",
        overflow: "hidden",
      }}
    >
      <View
        style={{
          position: "absolute",
          inset: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <PixelAvatar size={size} />
      </View>
      {uri && !failed && !reduced ? (
        <Video
          key={uri}
          source={{ uri }}
          muted
          repeat
          paused={!playing || !focused || !active}
          playInBackground={false}
          playWhenInactive={false}
          resizeMode="contain"
          controls={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{ width: size, height: size, opacity: loaded ? 1 : 0 }}
        />
      ) : null}
    </View>
  );
}

export function PixelBadge({
  label,
  color,
  background,
}: {
  label: string;
  color: string;
  background: string;
}) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        paddingHorizontal: 7,
        paddingVertical: 3,
        backgroundColor: background,
      }}
    >
      <Text style={{ fontSize: 10, lineHeight: 15, fontWeight: "700", color }}>
        {label}
      </Text>
    </View>
  );
}
