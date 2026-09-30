import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * CHAT
 * Tabbed chat panel with reasoning replies and a composer.
 * ───────────────────────────────────────────────────────── */

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  reasoning?: string;
  text: string;
};

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    text: "How is mint chip performing compared to previous summers?",
  },
  {
    id: "m2",
    role: "assistant",
    reasoning: "Pulled 3 summers of mint chip sales for comparison.",
    text: "Mint chip is up 12% with stronger weekend peaks (+19% Fri–Sun).",
  },
];

export type ChatProps = {
  tabs?: string[];
  messages?: ChatMessage[];
  onSend?: (text: string) => void;
  style?: StyleProp<ViewStyle>;
};

export function Chat({
  tabs = ["Flavor Analyst", "Inventory Ops"],
  messages: initialMessages = DEFAULT_MESSAGES,
  onSend,
  style,
}: ChatProps) {
  useTheme();
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");

  const handleSend = () => {
    const clean = draft.trim();
    if (!clean) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: clean },
    ]);
    setDraft("");
    onSend?.(clean);
  };

  return (
    <View style={[styles.card, style]}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const selected = tab === activeTab;
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tab, selected && styles.tabActive]}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                {tab}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={styles.thread} contentContainerStyle={styles.threadContent}>
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.bubbleWrap,
              msg.role === "user" ? styles.bubbleUserWrap : styles.bubbleAssistantWrap,
            ]}
          >
            {msg.reasoning ? (
              <View style={styles.reasoningRow}>
                <View style={styles.reasoningDot} />
                <Text style={styles.reasoningText}>{msg.reasoning}</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.bubble,
                msg.role === "user" ? styles.bubbleUser : styles.bubbleAssistant,
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  msg.role === "user" && styles.bubbleUserText,
                ]}
              >
                {msg.text}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask follow-up…"
          placeholderTextColor={theme.ink3}
          onSubmitEditing={handleSend}
          style={styles.input}
        />
        <Pressable onPress={handleSend} style={styles.sendBtn}>
          <Text style={styles.sendIcon}>↑</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    overflow: "hidden",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
    backgroundColor: theme.surface,
    paddingHorizontal: 8,
    paddingTop: 6,
    gap: 4,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  tabActive: {
    backgroundColor: theme.surfaceRaised,
  },
  tabText: {
    color: theme.muted,
    fontSize: 12,
    fontWeight: "500",
  },
  tabTextActive: {
    color: theme.text,
    fontWeight: "600",
  },
  thread: {
    maxHeight: 220,
  },
  threadContent: {
    padding: 12,
    gap: 10,
  },
  bubbleWrap: {
    gap: 4,
  },
  bubbleUserWrap: {
    alignItems: "flex-end",
  },
  bubbleAssistantWrap: {
    alignItems: "flex-start",
  },
  reasoningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 4,
  },
  reasoningDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.accent,
  },
  reasoningText: {
    color: theme.muted,
    fontSize: 11.5,
  },
  bubble: {
    maxWidth: "88%",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bubbleUser: {
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
  },
  bubbleAssistant: {
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
  },
  bubbleText: {
    color: theme.text,
    fontSize: 13,
    lineHeight: 18,
  },
  bubbleUserText: {
    color: theme.ink1,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.line,
    backgroundColor: theme.surface,
  },
  input: {
    flex: 1,
    color: theme.text,
    fontSize: 13,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.text,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: "700",
  },
}));
