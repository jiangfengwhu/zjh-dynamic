import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { EdgeModal as Modal } from "../edge";
import { Button } from "../shadcn/Button";
import { Skeleton } from "../shadcn/Skeleton";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * AGENT SCREEN (live viewer) — React Native port of Beautiful UI
 * Watch an agent work. The resting card is a framed capture of
 * the agent's screen; tapping "Open" expands to a full-screen
 * modal viewer where you can "Teach a task" (starts recording),
 * collapse while recording keeps running, and "End" it.
 * ───────────────────────────────────────────────────────── */

function fmt(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function FauxWindow() {
  return (
    <View style={styles.fauxWindow}>
      <View style={styles.fauxTitleBar}>
        <View style={styles.trafficLights}>
          <View style={[styles.dot, { backgroundColor: theme.red }]} />
          <View style={[styles.dot, { backgroundColor: theme.orange }]} />
          <View style={[styles.dot, { backgroundColor: theme.green }]} />
        </View>
        <View style={styles.fauxTab}>
          <View style={styles.fauxTabIcon} />
          <View style={styles.fauxTabBar} />
        </View>
      </View>

      <View style={styles.fauxAddressBar}>
        <Text style={styles.navArrows}>‹ ›</Text>
        <View style={styles.urlPill}>
          <Text style={styles.urlText} numberOfLines={1}>
            hunter.io/try/search/ugly.cash
          </Text>
        </View>
      </View>

      <View style={styles.fauxBody}>
        <View style={styles.fauxSearchRow}>
          <View style={styles.fauxSearchField} />
          <View style={styles.fauxSearchBtn} />
        </View>
        {[0.45, 0.6, 0.38, 0.52].map((w, i) => (
          <View key={i} style={styles.fauxResultRow}>
            <View style={styles.fauxAvatar} />
            <View style={styles.fauxResultLines}>
              <View style={[styles.fauxLineStrong, { width: `${w * 100}%` }]} />
              <View style={styles.fauxLineSoft} />
            </View>
          </View>
        ))}
      </View>

      {/* Floating decorative pointer */}
      <View style={styles.cursorBadge}>
        <Text style={styles.cursorArrow}>↖</Text>
        <Text style={styles.cursorTag}>Agent</Text>
      </View>
    </View>
  );
}

export type AgentScreenVariant = "Working" | "Loading" | "Default";

export type AgentScreenProps = {
  agentName?: string;
  streamSrc?: string;
  variant?: AgentScreenVariant;
  style?: StyleProp<ViewStyle>;
};

export function AgentScreen({
  agentName = "Agent",
  streamSrc,
  variant = "Working",
  style,
}: AgentScreenProps = {}) {
  useTheme();
  const loading = variant === "Loading";
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const startRecording = () => {
    setSecs(0);
    setRecording(true);
  };

  const endRecording = () => {
    setRecording(false);
    setSecs(0);
  };

  return (
    <View style={[styles.container, style]}>
      <Pressable
        disabled={loading}
        onPress={() => setOpen(true)}
        style={styles.restingCard}
      >
        {loading ? (
          <View style={styles.loadingScreen}>
            <Skeleton height={80} style={{ backgroundColor: theme.line }} />
            <Text style={styles.loadingText}>
              Connecting to agent&apos;s screen
            </Text>
          </View>
        ) : streamSrc ? (
          <Image
            source={{ uri: streamSrc }}
            style={styles.streamImage}
            resizeMode="cover"
          />
        ) : (
          <FauxWindow />
        )}

        {!loading ? (
          <View style={styles.openOverlay}>
            <Button
              variant="accent"
              size="sm"
              label="⤢ Open"
              onPress={() => setOpen(true)}
            />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.captionRow}>
        <Text style={styles.captionText}>{agentName}&apos;s screen</Text>
        {recording ? (
          <View style={styles.recPill}>
            <View style={styles.recDot} />
            <Text style={styles.recText}>REC {fmt(secs)}</Text>
          </View>
        ) : null}
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalWindow}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleGroup}>
                <Text style={styles.modalTitle}>{agentName}</Text>
                {recording ? (
                  <View style={styles.recPill}>
                    <View style={styles.recDot} />
                    <Text style={styles.recText}>{fmt(secs)}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.modalControls}>
                {recording ? (
                  <Button
                    variant="destructive"
                    size="sm"
                    label="■ End"
                    onPress={endRecording}
                  />
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    label="● Teach a task"
                    onPress={startRecording}
                  />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  label="✕"
                  onPress={() => setOpen(false)}
                />
              </View>
            </View>

            <View style={styles.modalViewport}>
              {streamSrc ? (
                <Image
                  source={{ uri: streamSrc }}
                  style={styles.streamImage}
                  resizeMode="contain"
                />
              ) : (
                <FauxWindow />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default AgentScreen;

const styles = themedStyleSheet(() => ({
  container: {
    width: "100%",
    gap: 8,
  },
  restingCard: {
    height: 200,
    borderRadius: theme.radius.window,
    backgroundColor: theme.inset,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    overflow: "hidden",
    position: "relative",
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12.5,
    fontWeight: "500",
  },
  streamImage: {
    width: "100%",
    height: "100%",
  },
  fauxWindow: {
    flex: 1,
    backgroundColor: theme.surface,
  },
  fauxTitleBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.inset,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  trafficLights: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  fauxTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    backgroundColor: theme.surface,
  },
  fauxTabIcon: {
    width: 7,
    height: 7,
    borderRadius: 2,
    backgroundColor: theme.accent,
  },
  fauxTabBar: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.lineStrong,
  },
  fauxAddressBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  navArrows: {
    color: theme.muted,
    fontSize: 11,
  },
  urlPill: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: theme.field,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  urlText: {
    color: theme.muted,
    fontSize: 9.5,
  },
  fauxBody: {
    flex: 1,
    padding: 10,
    gap: 8,
  },
  fauxSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 6,
    borderRadius: 8,
    backgroundColor: theme.inset,
  },
  fauxSearchField: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.surface,
  },
  fauxSearchBtn: {
    width: 32,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.accent,
  },
  fauxResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fauxAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.accentTint,
  },
  fauxResultLines: {
    flex: 1,
    gap: 4,
  },
  fauxLineStrong: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.lineStrong,
  },
  fauxLineSoft: {
    width: "58%",
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.line,
  },
  cursorBadge: {
    position: "absolute",
    left: "44%",
    top: "52%",
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: theme.text,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  cursorArrow: {
    color: theme.ink,
    fontSize: 10,
    fontWeight: "700",
  },
  cursorTag: {
    color: theme.ink,
    fontSize: 9.5,
    fontWeight: "700",
  },
  openOverlay: {
    position: "absolute",
    right: 10,
    bottom: 10,
  },
  captionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  captionText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "500",
  },
  recPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
    backgroundColor: theme.redTint,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.red,
  },
  recText: {
    color: theme.redText,
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    padding: 16,
  },
  modalWindow: {
    backgroundColor: theme.surfaceRaised,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 10,
    gap: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  modalControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalViewport: {
    height: 260,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: theme.inset,
  },
}));
