import { Text } from "../../../../../packages/ui/primitives/Typography";
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { Linking, StyleSheet, View, useWindowDimensions } from "react-native";
import {
  TRenderEngineProvider,
  RenderHTMLConfigProvider,
  RenderHTMLSource,
  useAmbientTRenderEngine,
  IMGElement,
  defaultSystemFonts,
  useIMGElementProps,
  type RenderHTMLProps,
  type CustomBlockRenderer,
  type CustomMixedRenderer,
} from "@native-html/render";
import { ErrorBoundary } from "react-error-boundary";
import { notify as Toast } from "../../../../../packages/ui/feedback/Toasts";
import { useTheme } from "../../../../../packages/ui/theme";
import { PixelText } from "./PixelText";
import { htmlByteLength } from "./postDraft";
import { htmlNativeStyles, htmlTextLayout, prepareHtmlElement } from "./htmlStyles";
import { useFeedContentWidth } from "../../../../../packages/ui/feed/kit/FeedPresentation";
import { cachedHtmlDocument } from "./htmlDocumentCache";

const font = "Fusion Pixel 12px Proportional SC";
const fonts = [...defaultSystemFonts, font, "sans-serif", "serif", "monospace"];
const tags = new Set([
  "html",
  "body",
  "div",
  "p",
  "span",
  "h1",
  "h2",
  "h3",
  "h4",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "br",
  "hr",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "a",
  "img",
]);
const ignoreNode: NonNullable<RenderHTMLProps["ignoreDomNode"]> = (
  node,
  parent
) => {
  let depth = 0;
  for (
    let ancestor: typeof parent | null = parent;
    ancestor;
    ancestor = ancestor.parent
  )
    if (++depth > 20) return true;
  if (!("name" in node) || typeof node.name !== "string" || !("attribs" in node)) return false;
  if (!tags.has(node.name)) return true;
  if (
    node.name === "img" &&
    !/^https:\/\/[^\s]+$/i.test((node.attribs as Record<string, string>).src ?? "")
  )
    return true;
  return false;
};
const defaultTextProps = { selectable: false };
const ignoredFontStyles: NonNullable<RenderHTMLProps["ignoredStyles"]> = ["fontFamily"];
const ignoredPixelFontStyles: NonNullable<RenderHTMLProps["ignoredStyles"]> = ["fontFamily", "fontWeight", "fontStyle"];
function CachedHtmlSource({ html, configuration, width }: { html: string; configuration: string; width: number }) {
  const engine = useAmbientTRenderEngine();
  const source = useMemo(() => cachedHtmlDocument(engine, html, configuration, htmlByteLength(html)), [engine, html, configuration]);
  return <RenderHTMLSource source={source} contentWidth={width} />;
}
function PostHtmlElement(props: ComponentProps<CustomMixedRenderer>) {
  const { InternalRenderer, TDefaultRenderer, TNodeChildrenRenderer, tnode } = props;
  const css = tnode.attributes.style ?? "";
  const native = htmlNativeStyles(css, tnode.attributes);
  const textLayout = htmlTextLayout(css, tnode.attributes);
  const style = StyleSheet.flatten([props.style, native]);
  if (props.type === "block" && InternalRenderer === TDefaultRenderer &&
      (textLayout.numberOfLines || native.textShadowColor) &&
      tnode.children.every(child => child.type === "text" || child.type === "phrasing")) {
    return <TDefaultRenderer {...props} style={style}>
      <Text {...props.textProps} {...textLayout} style={[tnode.styles.nativeTextFlow, {
        textShadowColor: native.textShadowColor, textShadowOffset: native.textShadowOffset, textShadowRadius: native.textShadowRadius,
      }]}>
        <TNodeChildrenRenderer tnode={tnode} propsForChildren={props.propsFromParent} />
      </Text>
    </TDefaultRenderer>;
  }
  return <InternalRenderer {...props} style={style} textProps={{ ...props.textProps, ...textLayout }} />;
}

/** A document is rendered directly, independently of installed application bundles. */
export const HtmlPostContent = memo(function HtmlPostContent({
  html,
  fallback,
  onApplication,
  onImage,
}: {
  html: string;
  fallback?: string;
  onApplication?: (id: string) => Promise<void>;
  onImage?: (url: string) => void;
}) {
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const [measuredWidth, setWidth] = useState(0);
  const rowContentWidth = useFeedContentWidth();
  const width = rowContentWidth ?? measuredWidth;
  const domVisitors = useMemo(() => ({
    onElement: (element: Parameters<typeof prepareHtmlElement>[0]) => prepareHtmlElement(element, { width, height: window.height }),
  }), [width, window.height]);
  const source = useMemo(
    () => ({
      html:
        htmlByteLength(html) <= 32768 && (html.match(/</g)?.length ?? 0) <= 512
          ? html
          : "<p>内容过长，请简化后再预览。</p>",
    }),
    [html]
  );
  const renderers = useMemo<NonNullable<RenderHTMLProps["renderers"]>>(
    () => ({
      ...Object.fromEntries([...tags].filter(tag => !["img", "html", "body"].includes(tag)).map(tag => [tag, PostHtmlElement])),
      img: function PostHtmlImage(props: ComponentProps<CustomBlockRenderer>) {
        const image = useIMGElementProps(props);
        return (
          <IMGElement
            {...image}
            onPress={
              onImage && image.source.uri
                ? () => onImage(image.source.uri!)
                : undefined
            }
          />
        );
      },
    }),
    [onImage]
  );
  const baseStyle = useMemo(
    () => ({
      color: colors.ink1,
      fontFamily: colors.typography.body,
      fontSize: 15,
      lineHeight: 22,
    }),
    [colors.ink1, colors.typography.body]
  );
  const tagsStyles = useMemo(
    () => ({
      ...Object.fromEntries([...tags].map(tag => [tag, {
        fontFamily: colors.typography.body,
        ...(colors.skin === "pixel-street" ? { fontWeight: "normal" as const, fontStyle: "normal" as const } : {}),
      }])),
      body: { margin: 0 },
      p: { marginTop: 0, marginBottom: 6 },
      a: { color: colors.accentText },
      pre: { fontFamily: colors.typography.mono },
      code: { fontFamily: colors.typography.mono },
    }),
    [colors.accentText, colors.typography.body, colors.typography.mono, colors.skin]
  );
  const openLink = useCallback(
    (_event: unknown, href: string) => {
      void (async () => {
        const app = /^zijinhua:\/\/app\/([a-z][a-z0-9-]{0,63})\/?$/.exec(href);
        if (app && onApplication) await onApplication(app[1]);
        else if (/^https:\/\/[^\s]+$/i.test(href)) await Linking.openURL(href);
        else throw new Error("该链接不支持打开");
      })().catch((error) =>
        Toast.show({
          type: "error",
          text1: "链接未能打开",
          text2: error.message,
        })
      );
    },
    [onApplication]
  );
  const renderersProps = useMemo(
    () => ({
      a: { onPress: openLink },
      img: { enableExperimentalPercentWidth: true },
    }),
    [openLink]
  );
  const configuration = JSON.stringify([width, window.height, colors.skin, colors.ink1, colors.accentText, colors.typography.body, colors.typography.mono]);
  return (
    <View
      style={{ width: "100%", minWidth: 0, overflow: "visible" }}
      onLayout={(event) => {
        if (rowContentWidth !== undefined) return;
        const nextWidth = event.nativeEvent.layout.width;
        setWidth((previous) =>
          Math.abs(previous - nextWidth) > 0.5 ? nextWidth : previous
        );
      }}
    >
      <ErrorBoundary
        resetKeys={[html, configuration]}
        fallback={
          <PixelText>{fallback || "这条动态的内容暂时无法展示"}</PixelText>
        }
      >
        {width > 0 ? <TRenderEngineProvider
          baseStyle={baseStyle}
          tagsStyles={tagsStyles}
          ignoredStyles={colors.skin === "pixel-street" ? ignoredPixelFontStyles : ignoredFontStyles}
          systemFonts={fonts}
          ignoreDomNode={ignoreNode}
          domVisitors={domVisitors}
        >
          <RenderHTMLConfigProvider defaultTextProps={defaultTextProps} renderersProps={renderersProps} renderers={renderers}>
            <CachedHtmlSource html={source.html} configuration={configuration} width={width} />
          </RenderHTMLConfigProvider>
        </TRenderEngineProvider> : null}
      </ErrorBoundary>
    </View>
  );
});
