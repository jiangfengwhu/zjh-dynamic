import { Linking, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { EnrichedMarkdownText } from "react-native-enriched-markdown";
import { useTheme } from "../theme";

export type RichMarkdownProps = {
  markdown: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  streaming?: boolean;
  selectable?: boolean;
  style?: StyleProp<ViewStyle>;
  onLinkPress?: (url: string) => void;
};

/** Own typography, link handling and streaming policy independently of the renderer. */
export function RichMarkdown({ markdown, fontFamily, fontSize = 14, lineHeight = 20, streaming = false, selectable = true, style, onLinkPress }: RichMarkdownProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const base = { fontFamily: fontFamily ?? colors.sans, fontSize, lineHeight, color: colors.ink1, marginTop: 0, marginBottom: 3 };
  return <EnrichedMarkdownText
    markdown={markdown}
    flavor="github"
    containerStyle={StyleSheet.flatten(style)}
    selectable={selectable}
    allowFontScaling
    streamingAnimation={streaming && !reducedMotion}
    streamingConfig={{ tableMode: "progressive", codeBlockMode: "progressive" }}
    onLinkPress={({ url }) => {
      if (onLinkPress) onLinkPress(url);
      else if (/^(https?:|mailto:|tel:)/i.test(url)) void Linking.openURL(url).catch(() => {});
    }}
    selectionMenuConfig={{ copy: { label: "复制" }, copyAsMarkdown: { label: "复制 Markdown" }, copyImageUrl: { label: "复制图片链接", pluralLabels: { other: "复制 {count} 个图片链接" } } }}
    markdownStyle={{
      paragraph: base,
      h1: { ...base, fontSize: fontSize + 8, lineHeight: lineHeight + 8 },
      h2: { ...base, fontSize: fontSize + 5, lineHeight: lineHeight + 5 },
      h3: { ...base, fontSize: fontSize + 2, lineHeight: lineHeight + 2 },
      h4: base, h5: base, h6: base,
      list: { ...base, bulletColor: colors.ink2, markerColor: colors.ink2, gapWidth: 6, itemSpacing: 2 },
      strong: { fontFamily: base.fontFamily, fontWeight: "bold", color: colors.ink1 },
      link: { fontFamily: base.fontFamily, color: colors.orchidText, underline: true },
      code: { fontFamily: colors.typography.mono, color: colors.ink2, backgroundColor: colors.inset },
      codeBlock: { ...base, fontFamily: colors.typography.mono, backgroundColor: colors.inset, padding: 8, borderRadius: colors.radius.sm },
      blockquote: { ...base, borderColor: colors.lineStrong, borderWidth: 2, gapWidth: 8 },
      table: { ...base, headerBackgroundColor: colors.inset, headerTextColor: colors.ink1, rowEvenBackgroundColor: colors.surface, rowOddBackgroundColor: colors.inset, borderColor: colors.lineStrong, borderWidth: 1, borderRadius: colors.radius.sm, cellPaddingHorizontal: 10, cellPaddingVertical: 8 },
    }}
  />;
}
