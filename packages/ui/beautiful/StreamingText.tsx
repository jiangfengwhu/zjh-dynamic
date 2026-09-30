import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Markdown from "react-native-markdown-display";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * STREAMING TEXT
 * Streamed answer with inline source citations, action bar,
 * expandable sources drawer, and follow-up suggestions.
 * Supports both `text` (Markdown string) and `content` (StreamingToken[]).
 * ───────────────────────────────────────────────────────── */

export type StreamingToken = { text: string; cite?: boolean };

export type StreamingSource = {
  name: string;
  domain: string;
  href: string;
  color?: string;
};

const DEFAULT_TOKENS: StreamingToken[] = [
  ..."Pistachio is your fastest-growing flavor — sales are up 23% this month and margins beat vanilla by 8 points."
    .split(" ")
    .map((text) => ({ text })),
  { text: "", cite: true },
  ..."Stone-fruit flavors are trending in the same range."
    .split(" ")
    .map((text) => ({ text })),
];

const DEFAULT_SOURCES: StreamingSource[] = [
  { name: "Scoop Data", domain: "scoopdata.io", href: "https://scoopdata.io/", color: "#1f7a5f" },
  { name: "Trends Index", domain: "trends.google.com", href: "https://trends.google.com/trends/", color: "#2f6fec" },
  { name: "Market Basket", domain: "marketbasket.io", href: "https://marketbasket.io/", color: "#e56d24" },
];

const DEFAULT_FOLLOW_UPS = [
  "Which flavors sell best in winter",
  "Compare gelato and soft serve margins",
];

export type StreamingTextProps = {
  /** Direct markdown string (used by live agent stream) */
  text?: string;
  /** Whether live stream is still running */
  streaming?: boolean;
  /** Tokenized demo or rich cited stream */
  content?: StreamingToken[];
  sources?: StreamingSource[];
  followUps?: string[];
  loop?: boolean;
  onFollowUp?: (prompt: string, index: number) => void;
  style?: StyleProp<ViewStyle>;
};

export function StreamingText({
  text,
  streaming = false,
  content = DEFAULT_TOKENS,
  sources = DEFAULT_SOURCES,
  followUps = DEFAULT_FOLLOW_UPS,
  loop = false,
  onFollowUp,
  style,
}: StreamingTextProps) {
  useTheme();
  const [count, setCount] = useState(content.length);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    if (text !== undefined) return;
    setCount(0);
  }, [text]);

  useEffect(() => {
    if (text !== undefined) return;
    const done = count >= content.length;
    if (done && !loop) return;
    const timer = setTimeout(
      () => setCount((c) => (c >= content.length ? 0 : c + 1)),
      done ? 3000 : 45,
    );
    return () => clearTimeout(timer);
  }, [count, content.length, loop, text]);

  // If `text` is explicitly passed as empty string, render nothing (matches shell behavior)
  if (text !== undefined && !text) return null;

  const isStreaming = text !== undefined ? streaming : count < content.length;

  return (
    <View style={[styles.wrap, style]}>
      {text !== undefined ? (
        <View>
          <Markdown style={markdownStyles}>{text}</Markdown>
          {isStreaming ? <Text style={styles.caret}>▍</Text> : null}
        </View>
      ) : (
        <Text style={styles.paragraph}>
          {content.slice(0, count).map((tok, idx) =>
            tok.cite && sources[0] ? (
              <Text
                key={idx}
                onPress={() => Linking.openURL(sources[0].href).catch(() => {})}
                style={styles.inlineCite}
              >
                {" "}
                [{sources[0].domain}]{" "}
              </Text>
            ) : (
              <Text key={idx}>{tok.text} </Text>
            ),
          )}
          {isStreaming ? <Text style={styles.caret}>▍</Text> : null}
        </Text>
      )}

      {!isStreaming && sources.length > 0 ? (
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => setSourcesOpen((prev) => !prev)}
            style={styles.sourcesChip}
          >
            <View style={styles.avatarStack}>
              {sources.slice(0, 3).map((s) => (
                <View
                  key={s.domain}
                  style={[styles.sourceDot, { backgroundColor: s.color ?? theme.accent }]}
                />
              ))}
            </View>
            <Text style={styles.sourcesLabel}>{sources.length} sources</Text>
            <Text style={styles.chevron}>{sourcesOpen ? "▴" : "▾"}</Text>
          </Pressable>
        </View>
      ) : null}

      {sourcesOpen && !isStreaming ? (
        <View style={styles.sourcesList}>
          {sources.map((s) => (
            <Pressable
              key={s.domain}
              onPress={() => Linking.openURL(s.href).catch(() => {})}
              style={styles.sourceRow}
            >
              <View style={[styles.sourceDot, { backgroundColor: s.color ?? theme.accent }]} />
              <Text style={styles.sourceName}>{s.name}</Text>
              <Text style={styles.sourceDomain}>{s.domain}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!isStreaming && followUps.length > 0 && onFollowUp ? (
        <View style={styles.followUpWrap}>
          <Text style={styles.followUpHeading}>Follow-ups</Text>
          {followUps.map((item, idx) => (
            <Pressable
              key={item}
              onPress={() => onFollowUp(item, idx)}
              style={styles.followUpRow}
            >
              <Text style={styles.followUpArrow}>↳</Text>
              <Text style={styles.followUpText}>{item}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  wrap: {
    marginTop: 6,
    gap: 8,
  },
  paragraph: {
    color: theme.text,
    fontSize: 13.5,
    lineHeight: 20,
  },
  inlineCite: {
    color: theme.accentText,
    fontSize: 11.5,
    fontWeight: "600",
  },
  caret: {
    color: theme.accent,
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sourcesChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.inset,
  },
  avatarStack: {
    flexDirection: "row",
    gap: 3,
  },
  sourceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sourcesLabel: {
    color: theme.ink2,
    fontSize: 11.5,
    fontWeight: "500",
  },
  chevron: {
    color: theme.muted,
    fontSize: 10,
  },
  sourcesList: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.inset,
    padding: 6,
    gap: 4,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  sourceName: {
    color: theme.text,
    fontSize: 12,
    fontWeight: "500",
  },
  sourceDomain: {
    color: theme.muted,
    fontSize: 11,
    marginLeft: "auto",
  },
  followUpWrap: {
    gap: 4,
    marginTop: 2,
  },
  followUpHeading: {
    color: theme.muted,
    fontSize: 11.5,
    fontWeight: "600",
  },
  followUpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  followUpArrow: {
    color: theme.muted,
    fontSize: 12,
  },
  followUpText: {
    color: theme.text,
    fontSize: 12.5,
    flex: 1,
  },
}));

const markdownStyles = {
  body: { color: theme.text, fontSize: 14, lineHeight: 20 },
  text: { color: theme.text },
  code_inline: { color: theme.text, backgroundColor: theme.inkRaised },
  fence: { color: theme.text, backgroundColor: theme.inkRaised },
};
