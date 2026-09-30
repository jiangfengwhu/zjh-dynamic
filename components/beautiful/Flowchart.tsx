import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Badge } from "../shadcn/Badge";
import { theme, themedStyleSheet, useTheme } from "../theme";

/* ─────────────────────────────────────────────────────────
 * FLOWCHART
 * Workflow trigger and condition steps on a dotted canvas.
 * ───────────────────────────────────────────────────────── */

export type FlowchartNode = {
  id: string;
  kind: "Trigger" | "Condition" | "Action";
  title: string;
  subtitle: string;
  branchLabel?: string;
};

const DEFAULT_NODES: FlowchartNode[] = [
  {
    id: "n1",
    kind: "Trigger",
    title: "Weekly POS Inventory Sync",
    subtitle: "Every Friday at 18:00",
  },
  {
    id: "n2",
    kind: "Condition",
    title: "Weekly scoops < 40 OR Stock < 7d",
    subtitle: "Evaluates 24 active flavors",
    branchLabel: "True → Restock",
  },
  {
    id: "n3",
    kind: "Action",
    title: "Draft Cone King Purchase Order",
    subtitle: "Queues human-in-the-loop approval",
  },
];

export type FlowchartProps = {
  nodes?: FlowchartNode[];
  style?: StyleProp<ViewStyle>;
};

export function Flowchart({ nodes = DEFAULT_NODES, style }: FlowchartProps) {
  useTheme();
  return (
    <View style={[styles.canvas, style]}>
      {nodes.map((node, idx) => (
        <View key={node.id} style={styles.stepWrap}>
          <View style={styles.nodeCard}>
            <View style={styles.nodeHeader}>
              <Badge
                tone={
                  node.kind === "Trigger"
                    ? "accent"
                    : node.kind === "Condition"
                      ? "warning"
                      : "success"
                }
              >
                {node.kind}
              </Badge>
              {node.branchLabel ? (
                <Text style={styles.branchText}>{node.branchLabel}</Text>
              ) : null}
            </View>
            <Text style={styles.nodeTitle}>{node.title}</Text>
            <Text style={styles.nodeSub}>{node.subtitle}</Text>
          </View>

          {idx < nodes.length - 1 ? (
            <View style={styles.connector}>
              <View style={styles.connectorLine} />
              <Text style={styles.connectorArrow}>▾</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = themedStyleSheet(() => ({
  canvas: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.line,
    padding: 14,
  },
  stepWrap: {
    alignItems: "center",
  },
  nodeCard: {
    width: "100%",
    borderRadius: theme.radius.md,
    backgroundColor: theme.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.lineStrong,
    padding: 12,
    gap: 4,
  },
  nodeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  branchText: {
    color: theme.orangeText,
    fontSize: 11,
    fontWeight: "600",
  },
  nodeTitle: {
    color: theme.text,
    fontSize: 13.5,
    fontWeight: "600",
    marginTop: 2,
  },
  nodeSub: {
    color: theme.muted,
    fontSize: 12,
  },
  connector: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
  },
  connectorLine: {
    width: 1.5,
    flex: 1,
    backgroundColor: theme.lineStrong,
  },
  connectorArrow: {
    color: theme.muted,
    fontSize: 10,
    marginTop: -4,
  },
}));
