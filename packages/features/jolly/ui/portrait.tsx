import { JollyVideoPlayer } from "./video";
import type { AppAvatarProps } from "@zijinhua/app-sdk";

export function JollyPortrait({ size, animated = false, borderRadius = size / 2 }: AppAvatarProps) {
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
