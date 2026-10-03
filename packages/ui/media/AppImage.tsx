import { Image, StyleSheet, type ImageProps } from "react-native";
import { NitroImage } from "react-native-nitro-image";

/** Stable SDK image entry. Native Image preserves headers, animation and callbacks. */
export function AppImage({ source, resizeMode = "cover", ...props }: ImageProps) {
  const asset = source && !Array.isArray(source) && typeof source !== "number" ? source : undefined;
  const uri = asset?.uri;
  const imageStyle = StyleSheet.flatten(props.style);
  if (!source || (typeof source !== "number" && !uri) || props.onError || props.onLoad || props.onLoadStart || props.onLoadEnd || props.onProgress || props.tintColor || imageStyle?.tintColor || imageStyle?.resizeMode || props.defaultSource || props.loadingIndicatorSource || resizeMode === "repeat" || asset?.headers || asset?.method || asset?.body || asset?.cache || (uri && !/^(https?:|file:)/.test(uri)) || /\.(gif|webp)(?:[?#]|$)/i.test(uri ?? "") || Array.isArray(source)) {
    return <Image source={source} resizeMode={resizeMode} {...props} />;
  }
  const image = typeof source === "number" ? source : uri?.startsWith("file:")
    ? { filePath: uri.replace(/^file:\/\//, "") }
    : { url: uri!, options: { scaleDownLargeImages: true } };
  return <NitroImage image={image} recyclingKey={uri ?? String(source)} resizeMode={resizeMode} {...props} />;
}
