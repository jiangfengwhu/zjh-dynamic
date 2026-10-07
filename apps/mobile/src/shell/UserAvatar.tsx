import { memo, useState } from "react";
import { Image, View, StyleSheet, type ImageProps, type StyleProp, type ViewStyle } from "react-native";
import { pixelAssets } from "./feed/pixelAssets";
import { useAccount } from "./account";

export const defaultAvatarSource = { uri: `data:image/webp;base64,${pixelAssets.avatar.base64}` };

/** All user identities share one fallback, round crop and current-account avatar. */
export const UserAvatar = memo(function UserAvatar({ uri, authorId, size = 36, style, onError }: {
  uri?: string | null;
  authorId?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  onError?: ImageProps["onError"];
}) {
  const { user } = useAccount();
  const currentUri = authorId && user && authorId === user.id ? user.avatarUrl : uri;
  const [failedUri, setFailedUri] = useState<string | null>();
  return <View accessible={false} style={[style, { width: size, height: size, borderRadius: size / 2, overflow: "hidden" }]}>
    <Image accessible={false} source={defaultAvatarSource} resizeMode="cover" resizeMethod="resize" resizeMultiplier={1.5} fadeDuration={0} style={StyleSheet.absoluteFill} />
    {currentUri && failedUri !== currentUri ? <Image key={currentUri} accessible={false} source={{ uri: currentUri }} resizeMode="cover" resizeMethod="resize" resizeMultiplier={1.5} fadeDuration={0} style={StyleSheet.absoluteFill} onError={event => { setFailedUri(currentUri); onError?.(event); }} /> : null}
  </View>;
});
