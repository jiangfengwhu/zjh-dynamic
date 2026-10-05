import {
  memo,
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { Linking, View, useWindowDimensions } from "react-native";
import RenderHtml, {
  IMGElement,
  useIMGElementProps,
  type RenderHTMLProps,
  type CustomBlockRenderer,
} from "@native-html/render";
import { ErrorBoundary } from "react-error-boundary";
import Toast from "react-native-toast-message";
import { useTheme } from "../../../../../packages/ui/theme";
import { PixelText } from "./PixelText";
import { htmlByteLength } from "./postDraft";
import { htmlNativeStyles, prepareHtmlElement } from "./htmlStyles";

const font = "Fusion Pixel 12px Proportional SC";
const fonts = [font];
const allowedStyles = [
  "color",
  "background",
  "backgroundColor",
  "border",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "textAlign",
  "textDecorationLine",
  "lineHeight",
  "padding",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "margin",
  "marginLeft",
  "marginRight",
  "marginTop",
  "marginBottom",
  "borderColor",
  "borderWidth",
  "borderStyle",
  "borderRadius",
  ...["Top", "Right", "Bottom", "Left"].flatMap((side) => [
    `border${side}Color`, `border${side}Width`,
  ]),
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomLeftRadius",
  "borderBottomRightRadius",
  "width",
  "height",
  "maxWidth",
  "minWidth",
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "display",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
] as NonNullable<RenderHTMLProps["allowedStyles"]>;
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
  if (!("name" in node)) return false;
  if (!tags.has(node.name)) return true;
  if (
    node.name === "img" &&
    !/^https:\/\/[^\s]+$/i.test(node.attribs.src ?? "")
  )
    return true;
  return false;
};
const defaultTextProps = { selectable: false };
const domVisitors = { onElement: prepareHtmlElement };
function PostHtmlBlock(props: ComponentProps<CustomBlockRenderer>) {
  const { TDefaultRenderer, tnode } = props;
  return <TDefaultRenderer {...props} style={[props.style, htmlNativeStyles(tnode.attributes.style ?? "")]} />;
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
  const width = measuredWidth || Math.max(1, window.width - 104);
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
      div: PostHtmlBlock,
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
      fontFamily: font,
      fontSize: 15,
      lineHeight: 22,
    }),
    [colors.ink1]
  );
  const tagsStyles = useMemo(
    () => ({
      body: { margin: 0 },
      p: { marginTop: 0, marginBottom: 6 },
      a: { color: colors.accentText },
      pre: { fontFamily: font },
      code: { fontFamily: font },
    }),
    [colors.accentText]
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
  return (
    <View
      style={{ width: "100%", minWidth: 0, overflow: "hidden" }}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        setWidth((previous) =>
          Math.abs(previous - nextWidth) > 0.5 ? nextWidth : previous
        );
      }}
    >
      <ErrorBoundary
        resetKeys={[html]}
        fallback={
          <PixelText>{fallback || "这条动态的内容暂时无法展示"}</PixelText>
        }
      >
        <RenderHtml
          contentWidth={width}
          source={source}
          baseStyle={baseStyle}
          tagsStyles={tagsStyles}
          systemFonts={fonts}
          allowedStyles={allowedStyles}
          ignoreDomNode={ignoreNode}
          domVisitors={domVisitors}
          defaultTextProps={defaultTextProps}
          renderersProps={renderersProps}
          renderers={renderers}
        />
      </ErrorBoundary>
    </View>
  );
});
