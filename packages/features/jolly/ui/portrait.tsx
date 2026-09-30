import { JollyVideoPlayer } from "./video";

export function JollyPortrait({ size }: { size: number }) {
  return (
    <JollyVideoPlayer
      src="jolly_idle"
      still
      repeat={false}
      width={size}
      height={size}
      borderRadius={size / 2}
      resizeMode="cover"
    />
  );
}
