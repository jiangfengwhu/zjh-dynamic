import { Image } from "react-native";
import posters from "../posters.json";
import { JollyVideoPlayer } from "./video";
import type { AppAvatarProps } from "../../../../../../packages/app-sdk/src/index";

export function JollyPortrait({
  size,
  animated = false,
  borderRadius = size / 2,
}: AppAvatarProps) {
  if (!animated) {
    return (
      <Image
        accessible={false}
        source={{ uri: posters.jolly_idle }}
        resizeMode="cover"
        fadeDuration={0}
        style={{ width: size, height: size, borderRadius }}
      />
    );
  }
  return (
    <JollyVideoPlayer
      src="jolly_idle"
      still={!animated}
      repeat={animated}
      width={size}
      height={size}
      borderRadius={borderRadius}
      resizeMode="cover"
    />
  );
}
