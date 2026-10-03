import {
  Children,
  isValidElement,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Image,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text as NativeText,
  View,
  useWindowDimensions,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  ImageFormat,
  Skia,
  TextAlign,
  type SkTypefaceFontProvider,
} from "@shopify/react-native-skia";
import { useTheme } from "../../../../../packages/ui/theme";
import { pixelFontAsset } from "./pixelFontAsset";

const FAMILY = "Fusion Pixel 12px Proportional SC";
let provider: SkTypefaceFontProvider | undefined;
function fontProvider() {
  if (!provider) {
    const data = Skia.Data.fromBase64(pixelFontAsset.base64);
    const face = Skia.Typeface.MakeFreeTypeFaceFromData(data);
    data.dispose();
    if (!face) throw new Error("像素字体无法加载");
    provider = Skia.TypefaceFontProvider.Make();
    provider.registerFont(face, FAMILY);
    face.dispose();
  }
  return provider;
}

type Run = { text: string; style: TextStyle };
function textRuns(
  children: ReactNode,
  inherited: TextStyle,
  runs: Run[] = []
): Run[] {
  Children.forEach(children, (child) => {
    if (typeof child === "string" || typeof child === "number")
      runs.push({ text: String(child), style: inherited });
    else if (isValidElement<TextProps>(child))
      textRuns(
        child.props.children,
        { ...inherited, ...StyleSheet.flatten(child.props.style) },
        runs
      );
  });
  return runs;
}
function hasInlineAction(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) =>
      isValidElement<TextProps>(child) &&
      (Boolean(child.props.onPress || child.props.onLongPress) ||
        hasInlineAction(child.props.children))
  );
}
function nativeChildren(children: ReactNode): ReactNode {
  return Children.map(children, (child) =>
    isValidElement<TextProps>(child) ? (
      <NativeText {...child.props}>
        {nativeChildren(child.props.children)}
      </NativeText>
    ) : (
      child
    )
  );
}

type Bitmap = { uri: string; width: number; height: number; intrinsic: number };
const bitmaps = new Map<string, Bitmap>();
let cacheBytes = 0;
/** CPU snapshots avoid allocating a live GPU canvas for every feed label. */
function rasterize(
  runs: Run[],
  width: number | undefined,
  lines: number | undefined,
  scale: number,
  density: number,
  align: TextStyle["textAlign"]
): Bitmap {
  const key = JSON.stringify([runs, width, lines, scale, density, align]);
  const cached = bitmaps.get(key);
  if (cached) {
    bitmaps.delete(key);
    bitmaps.set(key, cached);
    return cached;
  }
  const builder = Skia.ParagraphBuilder.Make(
    {
      maxLines: lines || undefined,
      ellipsis: lines ? "…" : undefined,
      textAlign:
        align === "center"
          ? TextAlign.Center
          : align === "right"
          ? TextAlign.Right
          : TextAlign.Left,
    },
    fontProvider()
  );
  for (const run of runs) {
    const size = (run.style.fontSize ?? 14) * scale;
    builder
      .pushStyle({
        fontFamilies: [FAMILY],
        fontSize: size,
        color: Skia.Color(
          typeof run.style.color === "string" ? run.style.color : "#FFF4DE"
        ),
        heightMultiplier:
          (run.style.lineHeight ?? (run.style.fontSize ?? 14) * 1.4) /
          (run.style.fontSize ?? 14),
        letterSpacing: (run.style.letterSpacing ?? 0) * scale,
        locale: "zh-Hans",
      })
      .addText(run.text)
      .pop();
  }
  const paragraph = builder.build();
  builder.dispose();
  paragraph.layout(100000);
  const intrinsic = Math.max(1, Math.ceil(paragraph.getMaxIntrinsicWidth()));
  const actualWidth = Math.max(1, width ?? Math.min(intrinsic, 600));
  paragraph.layout(actualWidth);
  const height = Math.max(1, Math.ceil(paragraph.getHeight()));
  const surface = Skia.Surface.Make(
    Math.ceil(actualWidth * density),
    Math.ceil(height * density)
  );
  if (!surface) {
    paragraph.dispose();
    throw new Error("文字渲染内存不足");
  }
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color("transparent"));
  canvas.scale(density, density);
  paragraph.paint(canvas, 0, 0);
  surface.flush();
  const snapshot = surface.makeImageSnapshot();
  const uri = `data:image/png;base64,${snapshot.encodeToBase64(
    ImageFormat.PNG
  )}`;
  snapshot.dispose();
  surface.dispose();
  paragraph.dispose();
  const result = { uri, width: actualWidth, height, intrinsic };
  // Bound retained PNG data. Native Image owns displayed images separately.
  while (
    bitmaps.size &&
    (bitmaps.size >= 160 || cacheBytes + uri.length > 2_000_000)
  ) {
    const oldest = bitmaps.keys().next().value!;
    cacheBytes -= bitmaps.get(oldest)!.uri.length;
    bitmaps.delete(oldest);
  }
  if (uri.length <= 2_000_000) {
    bitmaps.set(key, result);
    cacheBytes += uri.length;
  }
  return result;
}

/** Real bundled CJK glyphs, native accessibility labels and system font scaling.
 * Native selectable text remains native on detail screens and outside this feed.
 */
export function PixelText({
  children,
  style,
  pixel,
  ...props
}: TextProps & { pixel?: boolean }) {
  const { colors } = useTheme();
  const { fontScale } = useWindowDimensions();
  const enabled =
    pixel ?? (colors.canvas === "#171322" || colors.canvas === "#F1EDF8");
  const nativeInline = hasInlineAction(children);
  const [width, setWidth] = useState<number>();
  const flat = StyleSheet.flatten(style) ?? {};
  const runs = textRuns(children, { color: colors.ink1, ...flat });
  const signature = JSON.stringify(runs);
  const bitmap = useMemo(() => {
    if (!enabled || props.selectable || nativeInline) return undefined;
    try {
      return rasterize(
        runs,
        width,
        props.numberOfLines,
        props.allowFontScaling === false
          ? 1
          : Math.min(fontScale, props.maxFontSizeMultiplier || fontScale),
        PixelRatio.get(),
        flat.textAlign
      );
    } catch {
      return undefined;
    }
  }, [
    signature,
    width,
    enabled,
    nativeInline,
    props.selectable,
    props.numberOfLines,
    props.allowFontScaling,
    props.maxFontSizeMultiplier,
    fontScale,
    flat.textAlign,
  ]);
  if (!enabled || !bitmap || props.selectable || nativeInline)
    return (
      <NativeText {...props} style={style}>
        {nativeChildren(children)}
      </NativeText>
    );
  const {
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    lineHeight,
    letterSpacing,
    color,
    textAlign,
    textAlignVertical,
    textDecorationLine,
    textDecorationColor,
    textDecorationStyle,
    ...geometry
  } = flat;
  const Root = props.onPress || props.onLongPress ? Pressable : View;
  const label =
    props.accessibilityLabel ?? runs.map((run) => run.text).join("");
  return (
    <Root
      accessible={props.accessible ?? true}
      accessibilityRole={
        props.accessibilityRole ?? (props.onPress ? "button" : "text")
      }
      accessibilityLabel={label}
      accessibilityState={props.accessibilityState}
      accessibilityLiveRegion={props.accessibilityLiveRegion}
      testID={props.testID}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      style={[
        {
          width: bitmap.intrinsic,
          maxWidth: "100%",
          minHeight: bitmap.height,
          overflow: "hidden",
        },
        geometry as ViewStyle,
      ]}
      onLayout={(event) => {
        const next = Math.max(
          1,
          event.nativeEvent.layout.width -
            (flat.paddingHorizontal ?? flat.padding ?? 0) * 2
        );
        if (width === undefined || Math.abs(next - width) > 0.5) setWidth(next);
        props.onLayout?.(event);
      }}
    >
      <Image
        accessible={false}
        pointerEvents="none"
        source={{ uri: bitmap.uri }}
        resizeMode="stretch"
        style={{ width: bitmap.width, height: bitmap.height }}
      />
    </Root>
  );
}
